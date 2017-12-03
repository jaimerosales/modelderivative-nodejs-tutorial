var fs = require('fs');
var guid = require('guid'); // random guid generator
var async = require ('async'); // async package for use of waterfall in upload resumable
var chalk = require('chalk'); // coloring terminal console logs https://github.com/chalk/chalk
var logs = console.log;

var ForgeSDK = require('forge-apis');

// TODO - Check the file forge-auth.sh to set these ENV variables.
var CLIENT_ID     = process.env.FORGE_CLIENT_ID,
	CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET,
	BUCKET_KEY    = process.env.FORGE_BUCKET_NAME + CLIENT_ID.toLowerCase(),
	FILE_NAME     = process.env.FORGE_FILE_NAME,
	FILE_PATH     = process.env.FORGE_FILE_PATH;

var bucketsApi     = new ForgeSDK.BucketsApi(), // Buckets Client
	objectsApi     = new ForgeSDK.ObjectsApi(), // Objects Client
	derivativesApi = new ForgeSDK.DerivativesApi(); // Derivatives Client

// Initialize the 2-legged OAuth2 client, set specific scopes and optionally set the `autoRefresh` parameter to true
// if you want the token to auto refresh
var autoRefresh = true; // or false

var oAuth2TwoLegged = new ForgeSDK.AuthClientTwoLegged(CLIENT_ID, CLIENT_SECRET, [
    'data:read',
    'data:write',
    'data:create',
    'bucket:read',
    'bucket:update',
    'bucket:create'
], autoRefresh);

oAuth2TwoLegged.authenticate().then(function(credentials){
    // The `credentials` object contains an access_token that is being used to call the endpoints.
    // In addition, this object is applied globally on the oAuth2TwoLegged client that you should use when calling secure endpoints.
}, function(err){
    console.error(err);
});

/**
 * General error handling method
 * @param err
 */
function defaultHandleError(err) {
	logs(chalk.bold.red('\x1b[31m Error:', err, '\x1b[0m' )) ;
}

/**
 * Gets the details of a bucket specified by a bucketKey.
 * Uses the oAuth2TwoLegged object that you retrieved previously.
 * @param bucketKey
 */
var getBucketDetails = function (bucketKey) {
	logs(chalk.bold.green("**** Getting bucket details :  ") + chalk.blue.bold(bucketKey));
	return bucketsApi.getBucketDetails(bucketKey, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};

/**
 * Create a new bucket.
 * Uses the oAuth2TwoLegged object that you retrieved previously.
 * @param bucketKey
 */
var createBucket = function (bucketKey) {
	logs(chalk.bold.green("**** Creating Bucket : ") + chalk.blue.bold(bucketKey));
	var createBucketJson = {'bucketKey': bucketKey, 'policyKey': 'persistent'};
	return bucketsApi.createBucket(createBucketJson, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};

/**
 * Get the buckets owned by an application.
 * Uses the oAuth2TwoLegged object that you retrieved previously.
 */
var getBuckets = function(){
	logs(chalk.bold.green("**** Getting all buckets ****"));
	return bucketsApi.getBuckets({},oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};

/**
 * This function first makes an API call to getBucketDetails endpoint with the provided bucketKey.
 * If the bucket doesn't exist - it makes another call to createBucket endpoint.
 * @param bucketKey
 * @returns {Promise - details of the bucket in Forge}
 */
var createBucketIfNotExist = function (bucketKey) {
	
	return new Promise(function(resolve, reject) {
		getBucketDetails(bucketKey).then(function (resp) {
				resolve(resp);
			},
			function (err) {
				if (err.statusCode === 404) {
					createBucket(bucketKey).then(function(res){
							resolve(res);
						},
						function(err){
							reject(err);
						})
				}
				else{
					reject(err);
				}
			});
	});
};


/**
 * Checker for Size of File, depending on size will run resumable upload or upload as a whole.
 * Uses the oAuth2TwoLegged object that you retrieved previously.
 * @param bucketKey
 * @param filePath
 * @param fileName
 */


var uploadFileCheck = function(bucketKey, filePath, fileName) {
     return new Promise(function (resolve, reject) {
        fs.readFile(filePath, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                if (data.length < 5242879){ // Less than 5MB files upload process
                    logs(chalk.bold.green("**** Uploading to bucket:") + chalk.blue.bold(bucketKey) + chalk.yellow.bold(" File:") + chalk.bgYellow.bold(filePath));
                    resolve(uploadFile(bucketKey, filePath, fileName));
                }
                else{
                    logs(chalk.bold.green("**** Uploading to bucket by chunks:") + chalk.blue.bold(bucketKey) + chalk.yellow.bold(" File:") + chalk.bgYellow.bold(filePath));
                    resolve(uploadFileChunk(bucketKey, filePath, fileName));
                }
            }
        })
    })
}


/**
 * Upload a File to previously created bucket.
 * Uses the oAuth2TwoLegged object that you retrieved previously.
 * @param bucketKey
 * @param filePath
 * @param fileName
 * @returns {Promise}
 */
var uploadFile = function(bucketKey, filePath, fileName){
	return new Promise(function(resolve, reject) {
		fs.readFile(filePath, function (err, data) {
			if (err){
				reject(err);
			}
			else{
				objectsApi.uploadObject(bucketKey, fileName, data.length, data, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
					function(res){
						resolve(res);
					},function(err){
						reject(err);
					}
				)
			}
		});
	});
};

/**
 * Upload a File to previously created bucket.
 * Uses the oAuth2TwoLegged object that you retrieved previously.
 * @param bucketKey
 * @param filePath
 * @param fileName
 * @returns {Promise}
 */
var uploadFileChunk = function(bucketKey, filePath, fileName) {
     return new Promise(function (resolve, reject) {
        fs.readFile(filePath, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                var chunkSize = 5 * 1024 * 1024
                var nbChunks = Math.ceil(data.length / chunkSize)
                var chunksMap = Array.from({
                    length: nbChunks
                }, (e, i) => i)

                // generates uniques session ID
                var sessionId = guid.create();
                var uploadChuckArray = [];

                var range;
                var readStream;

                // prepare the upload tasks
                chunksMap.map((chunkIdx) => {
                    var start = chunkIdx * chunkSize
                    var end = Math.min(data.length, (chunkIdx + 1) * chunkSize) - 1;

                    if (chunkIdx == (nbChunks - 1)) {
                        chunkSize = data.length - start; // Change the final content-length chunk since it will have a smaller number of bytes on last chunk
                    }

                    range = `bytes ${start}-${end}/${data.length}`
                    readStream = fs.createReadStream(filePath, {start, end})

                    chunksMap.forEach(function (chunk) {
                        uploadChuckArray.push(function (callback) {
                            logs(chalk.bold.green("**** Uploading Chunks ***** with Range ", range));
                        	objectsApi.uploadChunk(bucketKey, fileName, chunkSize, range, sessionId.value, readStream, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials())
								.then(callback)
								.catch(callback)
                        })
                    });

                    async.waterfall(uploadChuckArray, function (err, result) {
                       	if (err.statusCode == 200) {
							resolve(err)
						}
                    })


                });
            }
        });
	})
}
/**
 * Translate a source file from one format to another.  Derivatives are stored in a manifest that is updated each time this endpoint is used on a source file.  Note that this endpoint is asynchronous and initiates a process that runs in the background, rather than keeping an open HTTP connection until completion. Use the [GET {urn}/manifest](https://developer.autodesk.com/en/docs/model-derivative/v2/reference/http/urn-manifest-GET) endpoint to poll for the job’s completion. 
 * @param {module:model/JobPayload} job 
 * @param {Object} opts Optional parameters
 * @param {Boolean} opts.xAdsForce `true`: the endpoint replaces previously translated output file types with the newly generated derivatives  `false` (default): previously created derivatives are not replaced  (default to false)
 * data is of type: {module:model/Job}
 * @param {Object} oauth2client oauth2client for the call
 * @param {Object} credentials credentials for the call
 */
var translateFile = function(encodedURN){
	logs(chalk.bold.green("**** Translating file derivative"));
	var postJob =
  	{
    	input: {
      		urn: encodedURN
    	},
    	output: {
      		formats: [
        		{
          			type: "svf",
          			views: ["2d", "3d"]
        		}
      		]
    	}
  	};

	return new Promise(function(resolve, reject) {
		derivativesApi.translate(postJob, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
			function(res){
				resolve(res);
			},function(err){
				reject(err);
			}
		)	
	});
};

 /**
  * Returns information about derivatives that correspond to a specific source file, including derviative URNs and statuses.  The URNs of the derivatives are used to download the generated derivatives when calling the [GET {urn}/manifest/{derivativeurn}](https://developer.autodesk.com/en/docs/model-derivative/v2/reference/http/urn-manifest-derivativeurn-GET) endpoint.  The statuses are used to verify whether the translation of requested output files is complete.  Note that different output files might complete their translation processes at different times, and therefore may have different &#x60;status&#x60; values.  When translating a source file a second time, the previously created manifest is not deleted; it appends the information (only new translations) to the manifest. 
  * @param {String} urn The Base64 (URL Safe) encoded design URN 
  * @param {Object} opts Optional parameters
  * @param {String} opts.acceptEncoding If specified with `gzip` or `*`, content will be compressed and returned in a GZIP format. 
  * data is of type: {module:model/Manifest}
  * @param {Object} oauth2client oauth2client for the call
  * @param {Object} credentials credentials for the call
  */


var manifestFile = function (encodedURN) {
	
	logs(chalk.bold.green("**** Getting File Manifest Status"));
	
	return new Promise(function(resolve, reject) {
		derivativesApi.getManifest(encodedURN, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
			function(res){
				if (res.body.progress != "complete"){
					logs(chalk.bold.yellow("The status of your file is ") + chalk.bgYellow.bold(res.body.status) + chalk.bold.yellow(" Please wait while we finish Translating your file"));
                    logs(chalk.bold.yellow("The percentage of your file is ") + chalk.bgYellow.bold(res.body.progress));

                }
				else{
					logs(chalk.bold.blue("****", res.body.status));
					logs(chalk.bold.blue("****", res.body.progress));
					resolve(res);
				}
				
			},function(err){
				reject(err);
			}
		)	
	});
}


/**
 * Create an access token and run the following API calls.
 * Create Bucket
 * Get Buckets
 * Upload File to Bucket
 * Translate File
 * Check Manifest Status of Translation of File
 */
oAuth2TwoLegged.authenticate().then(function(credentials){

	createBucketIfNotExist(BUCKET_KEY).then(

		function(createBucketRes){
		
			getBuckets().then(function(getBucketsRes){
				logs(chalk.bold.green("**** Get all buckets response:"));
				var bucketsArray = getBucketsRes.body.items;
				bucketsArray.map(function(currentBucket){
					logs(chalk.bold.yellow(currentBucket.bucketKey));
				})
			},function(err){
				console.error(err);
			});

            uploadFileCheck(BUCKET_KEY, FILE_PATH, FILE_NAME).then(function(uploadRes){
				const urnEncode = new Buffer(uploadRes.body.objectId).toString('base64');
				
				translateFile(urnEncode).then(function(translateRes){
					logs(chalk.bold.green("**** Translating file:") + chalk.bold.blue(urnEncode));
					
					manifestFile(urnEncode).then(function(){
						logs(chalk.bold.green("**** Your File is ready for viewing"));								
					}, defaultHandleError)	

				}, defaultHandleError);

			}, defaultHandleError);

		}, defaultHandleError);

}, defaultHandleError);
