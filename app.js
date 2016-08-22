/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the 'License'); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */


'use strict';

require('dotenv').config({
	silent : true
});

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var watson = require('watson-developer-cloud'); // watson sdk
// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

var vcapServices = require('vcap_services');
var url = require('url'), bodyParser = require('body-parser'), 
	http = require('http'), 
	https = require('https'),
	numeral = require('numeral');
	
var commonServices = require('./common_services');

var CONVERSATION_USERNAME = '',
	CONVERSATION_PASSWORD = '',
	TONE_ANALYZER_USERNAME = '',
	TONE_ANALYZER_PASSWORD = '';

var LOOKUP_BALANCE = 'balance';
var LOOKUP_TRANSACTIONS = 'transactions';

var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

//credentials
var conversation_credentials = vcapServices.getCredentials('conversation');
var tone_analyzer_credentials = vcapServices.getCredentials('tone_analyzer');

// Create the service wrapper
var conversation = watson.conversation({
	url : 'https://gateway.watsonplatform.net/conversation/api',
	username : conversation_credentials.username || CONVERSATION_USERNAME,
	password : conversation_credentials.password || CONVERSATION_PASSWORD,
	version_date : '2016-07-11',
	version : 'v1'
});

var tone_analyzer = watson.tone_analyzer({
	username : tone_analyzer_credentials.username || TONE_ANALYZER_USERNAME,
	password : tone_analyzer_credentials.password || TONE_ANALYZER_PASSWORD,
	url : 'https://gateway.watsonplatform.net/tone-analyzer/api',
	version : 'v3',
	version_date : '2016-05-19'
});

var WORKSPACE_ID = '<workspace-id>';

// Endpoint to be called from the client side
app.post('/api/message', function(req, res) {
	var workspace = process.env.WORKSPACE_ID || WORKSPACE_ID;
	
	if ( !workspace || workspace === '<workspace-id>' ) {
		return res.json( {
		  'output': {
			'text': 'Your app is running but it is yet to be configured with a <b>WORKSPACE_ID</b> environment variable. '+
					'These instructions will be provided in your lab handout <b>on the day of your lab.</b>'
			}
		} );
	}
	
	
	var payload = {
		workspace_id : workspace,
		context : {
			'person' : commonServices.getPerson()
		},
		input : {}
	};

	if (req.body) {
		if (req.body.input) {
			payload.input = req.body.input;
		}
		if (req.body.context) {
			// The client must maintain context/state
			payload.context = req.body.context;
		}

	}
	callconv(payload);

	// Send the input to the conversation service
	function callconv(payload) {
		var query_input = JSON.stringify(payload.input);
		var context_input = JSON.stringify(payload.context);

		tone_analyzer.tone({
			text : query_input,
			tones : 'emotion'
		}, function(err, tone) {
			var tone_anger_score = '';
			if (err) {
				console.log('Error occurred while invoking Tone analyzer. ::', err);
				//return res.status(err.code || 500).json(err);
			} else {
				var emotionTones = tone.document_tone.tone_categories[0].tones;
				
				var len = emotionTones.length;
				for (var i = 0; i < len; i++) {
					if (emotionTones[i].tone_id === 'anger') {
						console.log('Emotion_anger', emotionTones[i].score);
						tone_anger_score = emotionTones[i].score;
						break;
					}
				}
				
			}
			
			payload.context['tone_anger_score'] = tone_anger_score;
			
			conversation.message(payload, function(err, data) {
				if (err) {
					return res.status(err.code || 500).json(err);
				}else{
					//lookup actions 
					checkForLookupRequests(data, function(err, data){
						if (err) {
							return res.status(err.code || 500).json(err);
						}else{
							return res.json(data);
						}
					});
					
				}
			});
			
			
		});
	}

});

/**
*
* Looks for actions requested by conversation service and provides the requested data.
*
**/
function checkForLookupRequests(data, callback){
	console.log('checkForLookupRequests');
	
	if(data.context && data.context.action && data.context.action.lookup && data.context.action.lookup!= 'complete'){
		var workspace = process.env.WORKSPACE_ID || WORKSPACE_ID;
	    var payload = {
			workspace_id : workspace,
			context : data.context,
			input : data.input
		}
		
		//conversation requests a data lookup action
		if(data.context.action.lookup === LOOKUP_BALANCE){
			console.log('Lookup Balance requested');
			//if account type is specified (checking, savings or credit card)
			if(data.context.action.account_type && data.context.action.account_type!=''){
				
				//lookup account information services and update context with account data
				var accounts = commonServices.getAccountInfo(7829706, data.context.action.account_type);
				
				var len = accounts ? accounts.length : 0;
				
				var append_account_response = (data.context.action.append_response && 
						data.context.action.append_response) === true ? true : false;
				
				
				var accounts_result_text = '';
				
				for(var i=0;i<len;i++){
					accounts[i].balance = accounts[i].balance ? numeral(accounts[i].balance).format('$0,0.00') : '';
					
					if(accounts[i].available_credit)
						accounts[i].available_credit = accounts[i].available_credit ? numeral(accounts[i].available_credit).format('$0,0.00') : '';
					
					if(accounts[i].last_statement_balance)
						accounts[i].last_statement_balance = accounts[i].last_statement_balance ? numeral(accounts[i].last_statement_balance).format('$0,0.00') : '';
				
					if(append_account_response===true){
						accounts_result_text += accounts[i].number + ' ' + accounts[i].type + ' Balance: '+accounts[i].balance +'<br/>';
					}
				}
				
				payload.context['accounts'] = accounts;
				
				//clear the context's action since the lookup was completed.
				//update context action to empty in the subsequent turn and submit the data
				payload.context.action = {};
				
				if(!append_account_response){
					console.log('call conversation.message with lookup results.');
					conversation.message(payload, function(err, data) {
						if (err) {
							console.log('Error while calling conversation.message with lookup result', err);
							callback(err,null);
						}else {
							callback(null, data);
						}
					});
				}else{
					console.log('append lookup results to the output.');
					//append accounts list text to response array
					if(data.output.text){
						data.output.text.push(accounts_result_text);
					}
					callback(null, data);
					
				}
				
			}
			
		}else if(data.context.action.lookup === LOOKUP_TRANSACTIONS){
			console.log('Lookup Transactions requested');
			commonServices.getTransactions(7829706, data.context.action.category, function(err, transaction_response){
			
				if(err){
					console.log('Error while calling account services for transactions', err);
					callback(err,null);
				}else{
				
					var responseTxtAppend = '';
					if(data.context.action.append_total && data.context.action.append_total === true){
						responseTxtAppend += 'Total = <b>'+ numeral(transaction_response.total).format('$0,0.00') + '</b>';		
					}
					
					if(transaction_response.transactions && transaction_response.transactions.length>0){
						//append transactions
						var len = transaction_response.transactions.length;
						for(var i=0; i<len; i++){
							var transaction = transaction_response.transactions[i];
							if(data.context.action.append_response && data.context.action.append_response===true){
								responseTxtAppend += '<br/>'+transaction.date+' &nbsp;'+numeral(transaction.amount).format('$0,0.00')+' &nbsp;'+transaction.description;
							}
						}
					}
					if(responseTxtAppend != ''){
						console.log('append lookup transaction results to the output.');
						if(data.output.text){
							data.output.text.push(responseTxtAppend);
						}
					}
					callback(null, data);
					
					//clear the context's action since the lookup was completed.
					payload.context.action = {};
					return;
				}
			
			});
			
		}else{
			callback(null, data);
			return;
		}
	}else{
		callback(null, data);
		return;
	}
	
}



/**
 * Updates the response text using the intent confidence
 * 
 * @param {Object}
 *            input The request to the Conversation service
 * @param {Object}
 *            response The response from the Conversation service
 * @return {Object} The response with the updated message
 */
function updateMessage(input, response) {
	
	var responseText = null;
	
	if (response.intents && response.intents[0]) {
		
		var intent = response.intents[0];
		// Depending on the confidence of the response the app can return
		// different messages.
		// The confidence will vary depending on how well the system is trained.
		// The service will always try to assign
		// a class/intent to the input. If the confidence is low, then it
		// suggests the service is unsure of the
		// user's intent . In these cases it is usually best to return a
		// disambiguation message
		// ('I did not understand your intent, please rephrase your question',
		// etc..)
		if (intent.confidence <= 0.75 ) {
			console.log('Intent confidence is below 0.75. Ask the user to rephrase the question.');
			responseText = 'I did not understand your intent. Please rephrase the question.';
			response.output.text = [responseText];
		}
	}
	
	return response;
}


	
module.exports = app;
