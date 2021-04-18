import * as algosdk from "algosdk";
import * as fs from "fs"
import {compileProgram, createApp, waitForConfirmation} from "./utils" 
import {approvalProgramSourceRefactored, approvalProgramSourceInitial, clearProgramSource} from "./contracts"
import * as assert from "assert"

const NULL_OPTION_SYM = "NULL_OPTION"  // NOTE: could store it already encoded 
const ADD_OPTION_SYM = "add_options"

// demo account, will be replaced by wallet provided one 
// const creatorMnemonic = 'couple zone group already phone alley mercy napkin rival one talk carbon useless road bag anger impact ski media scout dune wave original absent grape'; 
const creatorMnemonic = "brush travel spot crumble network trigger kind pear depth warm dash assault poet jump frown aim embrace clog obtain simple six perfect junk abstract speak"

const creatorAccount = algosdk.mnemonicToSecretKey(creatorMnemonic);
const userMnemonic = "menu circle frozen typical radio cry various shrug chef dance inmate obtain trouble absent food bicycle twice bench undo rice snow click ability abstract mystery";

const baseServer = 'https://testnet-algorand.api.purestake.io/ps2'
const port = '';
const token = {
	'X-API-Key': process.env.PURESTAKE_ALGORAND_API
}

const algodClient = new algosdk.Algodv2(token, baseServer, port);
function loadCompiledPrograms() : {approval: Uint8Array, clearState: Uint8Array}{
	const approvalRead = fs.readFileSync("../ContractCode/quadratic_voting_approval.teal.tok", {encoding: "base64"})
	const approvalProgram = new Uint8Array(Buffer.from(approvalRead, "base64"))
	const clearRead = fs.readFileSync("../ContractCode/quadratic_voting_clear_state.teal.tok", {encoding: "base64"});
	const clearProgram = new Uint8Array(Buffer.from(clearRead, "base64"))
	return {approval: approvalProgram, clearState: clearProgram}
}


function encodeString(s: string) : Uint8Array {
	return new Uint8Array(Buffer.from(s));
}

function encodeNumber(n: number){
	return new Uint8Array([n]);
}

function pad(options: string[]) : string[] {
	assert(options.length <= 5)
	for (var i=0; options.length < 5; i++) {
		options.push(NULL_OPTION_SYM); 
	}
	return options;
}


function buildQVoteDeployArgs(decisionName: string, options: string[],
					  startTime: number, endTime: number, 
					  assetId: number, assetCoefficient: number) : Uint8Array[]{

	assert(options.length <= 5) 
	const appArgs = [encodeString(decisionName)]
						.concat(options.map(encodeString))
						.concat([assetId, assetCoefficient, startTime, endTime].map(encodeNumber))

	return appArgs;
}

/*
 * groups the options in lists of length 5 and pads the last one 
 */
function groupOptions(options: string[]) : string[][] {
	var out = [];
	options.map((d, i) => {(i%5==0) && (out.push([])); out[out.length-1].push(d)})
	out[out.length-1] = pad(out[out.length-1])
	return out;
}


function buildAddOptionTxn(options: string[]){ 
	var appArgs = [ADD_OPTION_SYM].concat(options).map(encodeString)

	return
}


// NOTE: we need a client in the sdk. We can create one here that has no prvileges over the account (we only need it to read data from the api). 
// The client that will sign transactions (injected by the wallet) should not be used in the sdk, or at least it should not be mandatory.

/*
 * Returns an unsigned transaction for deploying a QVote decision 
 */
async function buildDeployTx(client: any, creatorAddress: string,
							 startTime: number, registrationSeconds: number,
							 assetId: number, assetCoefficient: number, 
							 decisionName: string, options: string[]) {
								 
	assert(options.length <= 61)    // won't fit in the contract otherwise 
	var txs = []

	// Application Creation tx 
	const groupedOptions = groupOptions(options);
	const {approval, clearState} = loadCompiledPrograms();
    const onComplete = algosdk.OnApplicationComplete.NoOpOC;
    const params = await client.getTransactionParams().do();

	const localInts = 1;
	const localBytes = 1;
	const globalInts = options.length;   
	const globalBytes = 3;
	const endTime = startTime + registrationSeconds

	const appArgs = buildQVoteDeployArgs(decisionName, groupedOptions[0], startTime, endTime, assetId, assetCoefficient);
	const appCreateTx =  algosdk.makeApplicationCreateTxn(creatorAddress, params, onComplete, 
											approval, clearState, 
											localInts, localBytes, globalInts, globalBytes, 
											appArgs); 

	// Add option txs 
	// groupedOptions.slice(1).map((opts) => algosdk.makeApplicationNoOpTxn(creatorAddress, params, )
	return appCreateTx;
}

// TODO refactor this into an object, then use instance variables to access the grouped options and track the progress of setup etc.. 
// function optionRegisterTxs

// In general the approach is we build transactions that then people sign themselves. All of them. So in creation of the application, even the ones 
// needed to register voters. We return a list of transactions that have to be signed and sent. 

(async () => {
	try {
		const startTime = Math.round(Date.now() / 1000)
		const registrationSeconds = 300	
		const assetId = 13164495;
		const assetCoefficient = 2;
		const decisionName = "muchdecision"
		const options = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"]

		const deployTx = await buildDeployTx(algodClient, creatorAccount.addr, 
										 startTime, registrationSeconds, 
										 assetId, assetCoefficient, 
										 decisionName, options);

		const txId = deployTx.txID().toString();
		console.log("built tx", txId);

		let signedTxn = deployTx.signTxn(creatorAccount.sk);
		console.log("Signed transaction with txID: %s", txId);

		await algodClient.sendRawTransaction(signedTxn).do();
		console.log("SENT")

		await waitForConfirmation(algodClient, txId);

		// display results
		let transactionResponse = await algodClient.pendingTransactionInformation(txId).do();
		let appId = transactionResponse['application-index']; 

	   	// const appId = await deploy(creatorMnemonic); 
		console.log(appId)
	} catch (e) {
		console.log(e)
	}
})(); 


