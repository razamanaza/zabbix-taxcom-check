const Client = require('node-rest-client').Client;
const client = new Client();
const fs = require('fs');

const logfile = '/home/razamanaza/logs/receiptsChecks.log'
const today = new Date();
const reportDate = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

const credentials = {
	login: 'place-your-login-here@some-domain.com',
	password: 'place-your-password-here',
	inregratorID: 'taxcom-integrator-id'
};

const shops = [
	{name: 'art', id: 'branch-id', agreementNumber: 'agreement-number'},
	{name: 'vl1', id: 'branch-id', agreementNumber: 'agreement-number'},
	{name: 'vl2', id: 'branch-id', agreementNumber: 'agreement-number'},
	{name: 'vl3', id: 'branch-id', agreementNumber: 'agreement-number'},
	{name: 'les', id: 'branch-id', agreementNumber: 'agreement-number'},
	{name: 'nhk', id: 'branch-id', agreementNumber: 'agreement-number'},
	{name: 'ussr', id: 'branch-id', agreementNumber: 'agreement-number'},
	{name: 'fok', id: 'branch-id', agreementNumber: 'agreement-number'},
];

const getSessionToken = (agreementNumber) => {
	return new Promise((resolve) => {
		let args = {
			data: {agreementNumber,	login: credentials.login, password: credentials.password},
			headers: {'Content-Type': 'application/json', 'Integrator-ID': credentials.inregratorID}
		}
		client.post("https://api-lk-ofd.taxcom.ru/API/v2/Login", args, function (data, response) {
			resolve(data.sessionToken);
		});
	});
};

const getData = (args, url) => {
	return new Promise((resolve, reject) => {
		client.get(url, args, function(data){
			resolve(data);
		});
	});
};

const checkReceipts = async(shopsData) => {
	
	try {
		await Promise.all(
			shopsData.map(async(shop) => {
				shop.sessionToken = await getSessionToken(shop.agreementNumber);
				let args = {
					parameters: {id: shop.id, np: 'OK'},
					headers: {'Session-Token': shop.sessionToken}
				};
				shop.kktList = await getData(args, 'https://api-lk-ofd.taxcom.ru/API/v2/KKTList');
				await Promise.all(
					shop.kktList.records.map(async(kkt) => {
						kkt.documents = [];
						let args = {
							parameters: {fn: kkt.fnFactoryNumber, begin: `${reportDate}T00:00:00`, end: `${reportDate}T23:59:59`},
							headers: {'Session-Token': shop.sessionToken}
						};
						kkt.shift = await getData(args, 'https://api-lk-ofd.taxcom.ru/API/v2/ShiftList');
					})
				);
				const filteredKkt = shop.kktList.records.filter(kkt => kkt.shift.counts.recordCount > 0);
				await Promise.all(
					filteredKkt.map(async(kkt) => {
						await Promise.all(
							kkt.shift.records.map(async(shift) => {
								let args = {
									parameters: {fn: kkt.fnFactoryNumber, shift: shift.shiftNumber, type: 3},
									headers: {'Session-Token': shop.sessionToken}
								}
								const documents = await getData(args, 'https://api-lk-ofd.taxcom.ru/API/v2/DocumentList');
								const filteredDocuments = documents.records.filter(document => document.cashier === 'СИС. АДМИНИСТРАТОР');
								if (filteredDocuments.length > 0) {
									filteredDocuments.map(document => {
					const message = `Receipt error. Filial - ${shop.name}, kassa - ${kkt.name}, date - ${document.dateTime}\n`;
					console.log(message);
					fs.appendFile(logfile, message, (err) => {
						if (err) throw err;
					});
									})
								}
							})
						);
					})
				);
			})
		);
	} catch(error) {
    console.log(error);
    const message = `Script execution error. ${error}\n`;
    fs.appendFile(logfile, message, (err) => {
      if (err) throw err;
    });
	};
};

checkReceipts(shops);
