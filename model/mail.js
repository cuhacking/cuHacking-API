/**
 * cuHacking 2020 - Mailing
 *  
 * This file is responsible for communicating with the Mailchimp API
 * It defines a set of general operations which can be used to return information to other components.
 * 
 */


 /**
 * Imports and Setup
 */
const config = require('../config.json');

const Mailchimp = require('mailchimp-api-v3');
const mailchimp = new Mailchimp(config[process.env.NODE_ENV].mailchimp_api_key);
const crypto = require('crypto');

var Mail = module.exports;


/**
 * Create a new mailing list
 * 
 * @param {string} name     - The name of the list to create
 * 
 * @return {Promise}        - Promise returns the result of the create operation
 */
Mail.createList = function(name){

    let promise = new Promise(function(resolve, reject){
        // Maybe use a config file for these reminders?
        let list_settings = {
            "name": name,
            "contact":  {
                "company":  "cuHacking",
                "address1": "address",
                "city":     "Ottawa",
                "state":    "Ontario",
                "zip":      "zip",
                "country":  "Canada"
            },
            "permission_reminder": "You're receiving this email because you signed up for cuHacking 2020's mailing list.",
            "campaign_defaults":{
                "from_name":    "cuHacking",
                "from_email":   "noreply@cuhacking.com",
                "subject":      "cuHacking",
                "language":     "English"
            },
            "email_type_option": false
        };
        mailchimp.post('/lists', list_settings).then(function(res){
            resolve(res); 
        }, function(error){
            reject(error);
        });
    });

    return promise;
}


/**
 * Get a group in the specified mailing list
 * 
 * @param {string} list         - the name of the list which contains the group
 * @param {string} groupName    - the name of the group to get
 * 
 * @return {Promise}            - a Promise returning the result of GET operation on the group
 */
Mail.getGroup = function(list, groupName){

    let promise = new Promise(function(resolve, reject){

        Mail.getList(list).then(function(res){
            return mailchimp.get('/lists/' + res.id + '/interest-categories');
        }).then(function(groupRes){
            let categoryId = '';

            for(let g of groupRes.categories){
                if(g.title === groupName){
                    categoryId = g.id;
                }
            }

            return mailchimp.get('/lists/' + groupRes.list_id + '/interest-categories/' + categoryId + '/interests');
        }).then(function(res){

            for(let interest of res.interests){
                if(interest.name === groupName){
                    resolve(interest);
                }
            }

            reject("Group " + groupName + " not found.");
        }).catch(function(err){
            reject(err);
        });

    });

    return promise;

}


/**
 * Get a group in the specified mailing list
 * 
 * @param {string} list         - the name of the list to which to add the group
 * @param {string} groupName    - the name of the group to create
 * 
 * @return {Promise}            - a Promise returning the result of POST operation on the group
 */
Mail.createGroup = function(list, groupName){

    let promise = new Promise(function(resolve, reject){

        Mail.getList(list).then(function(res){
            return mailchimp.post('/lists/' + res.id + '/interest-categories', {
                "title": groupName,
                "type": "hidden"
            });
        }).then(function(res){
            resolve(res);
        }).catch(function(err){
            reject(err);
        });

    });

    return promise;

}


/**
 * Get a specific list from Mailchimp
 * 
 * @param {string} name     - The name of the list to get
 * 
 * @return {Promise}        - Promise returns the list object received from Mailchimp
 */
Mail.getList = function(name){

    let promise = new Promise(function(resolve, reject){
        mailchimp.get('/lists').then(function(res){
            for(let list of res.lists){
                if(list.name === name){
                    resolve(list);
                }
            }

            reject("List was not found");
        });
    });

    return promise;
}

/**
 * Get a specific user from Mailchimp. Used mostly for checking if the user exists
 * 
 * @param {string} list     - The name of the list to get the user from
 * @param {string} email    - The email of the user to get
 * 
 * @return {Promise}        - Promise returns the response from the Mailchimp get request
 */
Mail.getUser = function(list, email){

    let promise = new Promise(function(resolve, reject){
        Mail.getList(list).then(function(resList){

            mailchimp.get('/lists/' + resList.id + '/members/' + crypto.createHash('md5').update(email).digest("hex")).then(function(res){
                resolve(res)
            }, function(error){
                reject(error);
            });

        }, function(error){
            reject(error);
        });
        
    });

    return promise;
}

/**
 * Subscribe a user to a mailing list
 * 
 * @param {string} list         - The name of the list to add the email to. Creates list if it does not exist
 * @param {string} group        - The name of the group to add the email to
 * @param {string} email        - The email to add to the mailing list
 * 
 * @return {Promise}            - Promise returns the response from the add operation
 */
Mail.subscribe = function(list, email){
    
    let promise = new Promise(function(resolve, reject){

        Mail.getList(list).then(function(resList){
            // Use Promise.all to pass the result down the promise chain
            // PUT creates the user if they don't exist
            return Promise.all([mailchimp.put('/lists/' + resList.id + '/members/' + crypto.createHash('md5').update(email).digest('hex'), {
                "email_address": email,
                "status": "subscribed"
            }), resList]);
        }).then(function([addRes, resList]){
            return mailchimp.post('/lists/' + resList.id + '/members/' + crypto.createHash('md5').update(email).digest('hex') + '/tags', {
                "tags": [{
                    "name": "2020",
                    "status": "active"
                },
                {
                    "name": "newsletter",
                    "status": "active"
                }]
            });
        }).then(function(res){
           resolve(res); 
        }).catch(function(err){
            reject(err);
        });

    });

    return promise;
}

Mail.unsubscribe = function(list, email){

    let promise = new Promise(function(resolve, reject){
        
        Mail.getList(list).then(function(listRes){
            return mailchimp.delete('/lists/' + listRes.id + '/members/' + crypto.createHash('md5').update(email).digest('hex'));
        }).then(function(res){
            resolve(res);
        }).catch(function(err){
            reject(err);
        });

    });

    return promise;

}


/**
 * Add a tag to a user in Mailchimp
 * Subscribes them to the mailing list if they are not already subscribed
 */
Mail.addTag = function(list, email, tag){

    let promise = new Promise(function(resolve, reject){

        Mail.getList(list).then(function(resList){

            return mailchimp.post('/lists/' + resList.id + '/members/' + crypto.createHash('md5').update(email).digest('hex') + '/tags', {
                "tags": [{
                    "name": tag,
                    "status": "active"
                }]
            });

        }).then(function(res){
            resolve(res);
        }).catch(function(err){

            // If 404, user is likely not subscribed. Subscribe them, then add the tag
            if(err.status === 404){
                Mail.subscribe(list, email).then(function(){
                    return Mail.getList(list);
                }).then(function(resList){
                    return mailchimp.post('/lists/' + resList.id + '/members/' + crypto.createHash('md5').update(email).digest('hex') + '/tags', {
                        "tags": [{
                            "name": tag,
                            "status": "active"
                        }]
                    });
                }).then(function(res){
                    resolve(res);
                }).catch(function(subscribeErr){
                    reject(subscribeErr);
                });
            } else {
                reject(err);
            }
        });

    });

    return promise;

}