
var account_services =  {
	_person: {
					fname : 'Natalie',
					lname : 'Smith',
					address: {
						line1: '999 Gateway Dr',
						line2: '',
						city: 'Dallas',
						state: 'TX',
						zip: 888888,
						country: 'US'
					},
					customer_id : 7829706,
					tone_anger_threshold: 0.49
			  },
	getPerson: function(customerId){
		return this._person;	
	},
	_accounts: [
				{
					balance: 12800,
					number: 'xxx8990',
					type: 'savings'
				},
				{
					balance: 7600,
					number: 'xxx0744',
					type: 'checking'
				},
				{
					balance: 550,
					number: 'xxx7685',
					type: 'credit card',
					available_credit: 4450,
					payment_due_date: '25 Sep, 2016',
					last_statement_balance: 550
				}				
			],
			
	getAccountInfo: function (customerId, account_type) {
						//console.log('getAccountInfo :: start');
						var accounts = [];
	
						switch (account_type) {
							case 'savings' : 
								accounts.push(this._accounts[0])
								break;
							case 'checking' : 
								accounts.push(this._accounts[1])
								break;
							case 'credit card' : 
								accounts.push(this._accounts[2])
								break;
							default :
								accounts = this._accounts.slice();
						}
	
						//console.log('Returning account info ', JSON.stringify(accounts,null,2));
	
						return accounts;
  
					},
					
	getTransactions: function(customerId, category, callback){
		
		var response = {
			total: '',
			category: 'all',
			transactions: []
		};
		
		var len = this._transactions ? this._transactions.length : 0;
		var total = 0;
		
		var category_specified_bool = false;
		if(category && category!=='' && category!=='all'){
			category_specified_bool = true;
			response.category = category;
		}
		
		for(var i=0; i<len; i++){
			var transaction = this._transactions[i];
			if(category_specified_bool && transaction.category === category){
				response.transactions.push(transaction);
				total += transaction.amount;
			}else if(!category_specified_bool){
				total += transaction.amount;
			}
		}
		
		response.total = total;
		if(!category_specified_bool){
			response.transactions = this._transactions.slice();
		}
		
		callback(null, response);
	},
	
	_transactions : [
				{
					amount: 25.36,
					account_number: 'xxx7685',
					category: 'dining',
					description: 'Walnut Cafe',
					type: 'debit',
					date: '08-29-2016'
				},
				{
					amount: 37.50,
					account_number: 'xxx7685',
					category: 'dining',
					description: 'Italian Express',
					type: 'debit',
					date: '08-27-2016'
				},
				{
					amount: 78.90,
					account_number: 'xxx7685',
					category: 'grocery',
					description: 'Whole Foods',
					type: 'debit',
					date: '08-26-2016'
				},
				{
					amount: 91.25,
					account_number: 'xxx7685',
					category: 'grocery',
					description: 'Kroger Market',
					type: 'debit',
					date: '08-24-2016'
				},
				{
					amount: 360.75,
					account_number: 'xxx7685',
					category: 'travel',
					description: 'American Airlines',
					type: 'debit',
					date: '08-24-2016'
				},
				{
					amount: 35.10,
					account_number: 'xxx7685',
					category: 'fuel',
					description: 'Shell Fuel',
					type: 'debit',
					date: '08-20-2016'
				},
				{
					amount: 270.40,
					account_number: 'xxx7685',
					category: 'other',
					description: 'Home Furnishings',
					type: 'debit',
					date: '08-16-2016'
				}				
			]

}

module.exports = account_services;

