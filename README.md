# AlgorandQVoteSDK 😍 💥
### [Join our discord!](https://discord.gg/AWt6k9XhpT)

Quadratic Voting smart contract SDK for Algorand 
Awardee of the [Algorand Foundation Grants Program](https://algorand.foundation/grants-program)

# Quadratic Voting - very oversimplified

Quadratic Voting is a better way of voting. It allows you to express more than simply your favourite choice. You are given a number of credits you can distribute to the options according to how you feel about them. You can also give negative credits to the options you don't like. The effective number of votes you cast for a given amount of credits is the square root of the absolute number of credits. This encourages you to vote for multiple options instead of piling all your credits on one choice. In this way you effectively get to rank the options according to your preference, and also express the extent to which you like or dislike an option.

There's actually much more to quadratic voting. Read up about it here.
https://vitalik.ca/general/2019/12/07/quadratic.html
https://www.radicalxchange.org/concepts/quadratic-voting/

# The basics
This sdk is designed to help build applications that use quadratic voting. It's functionality handles [these](https://github.com/QVote/AlgorandQVoteContracts) smart contracts for you at a high level. Low level blockchain interactions are abstracted away (as much as possible). 

# Installing 
Make sure you have [algosdk](https://github.com/algorand/js-algorand-sdk) installed. 
If you want to use internal signing, you will need also [myalgo conect](https://github.com/randlabs/myalgo-connect#Installation)
Then simply 
`npm install @qvote/algorand-sdk@1.0.0`

# Using the SDK
There are two intended ways to use this SDK: internal signing and external siging. In the first case the sdk will take care of everything for the developer. The methods interacting with the smart contracts will take even of signing (using only Myalgo Connect at the moment). In the second case, the SDK will provide the developer with the built transactions for any call to the smart contracts, and will let them sign them however they please. The signed transactions can then be given back to the SDK to be deployed. 


## Internal signing example 
This method is only available in a browser, with a myalgo connect account set up. 

### Deploying a new QVoting contract 
```typescript 
const conf = {token: token, baseServer: baseServer, port: port}
const registrationTime = 10*60;  // in seconds 
const votingTime = 10*24*60*60   // 10 days to vote  

const {wallet, accounts} = await connectMyAlgo();
const creatorAddress = accounts[0].address

const params = {
  decisionName: "muchdecision", 
  votingStartTime: Math.round(Date.now() / 1000) + registrationTime,
  votingEndTime: Math.round(Date.now() / 1000) + registrationTime + votingTime,
  assetID: 13164495,
  assetCoefficient: 200,       // expressed in hundredths of a credit for 1 decimal place (not flexible at the moment)
  options:  ["first", "second", "third", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  creatorAddress: creatorAddress
}

const qv = new QVoting(conf, wallet, params)
await qv.deployNew() 
const appID = qv.getAppID()
console.log(appID) 

const state = await qv.readGlobalState();
await qv.optIn(creatorAddress); 

// did opt-in work? 
const localStorage = await qv.getUserBalance(creatorAddress);
```

### Opt-in
```typescript
const {wallet, accounts} = await connectMyAlgo();
if (accounts.length > 1) {
  console.log('more than one account selected, choosing the first one') 
}

const appID = 15856700;       // previously deployed appID 

const conf = {token: token, baseServer: baseServer, port: port}
const voterAddress = accounts[0].address

const qv = new QVoting(conf, wallet)  
await qv.initState(appID)	

const state = await qv.readGlobalState();
await qv.optIn(voterAddress); 

// did opt-in work? 
const localStorage = await qv.getUserBalance(voterAddress);
```

### Voting
```typescript
const {wallet, accounts} = await connectMyAlgo();
if (accounts.length > 1) {
  console.log('more than one account selected, choosing the first one') 
}
const appID = 16061819;   // previously deployed appID 

const conf = {token: token, baseServer: baseServer, port: port}
const voterAddress = accounts[0].address

const qv = new QVoting(conf, wallet)  
console.log('created new instance') 
await qv.initState(appID)	

var state = await qv.readGlobalState();
console.log('STATE', state);

const balance = await qv.getUserBalance(voterAddress) 
console.log('BALANCE', balance) 	

const options = [
    {optionTitle: 'second', creditNumber: 9},
    {optionTitle: 'first', creditNumber: 4}
  ]

await qv.vote(voterAddress, options); 

state = await qv.readGlobalState();
console.log('STATE', state);
``` 

## External signing example

### Deploying a new QVoting contract 

```typescript
const registrationTime = 40; // in seconds
const votingTime = 10 * 24 * 60 * 60; // 10 days to vote
const params = {
  decisionName: "muchdecision",
  votingStartTime:
      Math.round(Date.now() / 1000) + registrationTime,
  votingEndTime:
      Math.round(Date.now() / 1000) +
      registrationTime +
      votingTime,
  assetID: 13164495,
  assetCoefficient: 200, // expressed in hundredths of a credit for 1 decimal place (not flexible at the moment)
  options: [
      "first",
      "second",
      "third",
      "hey",
      "anotherone",
      "six",
  ],
  creatorAddress: creatorAccount.addr,
};

// build a new QVote object
// this prepares the contract fields etc...
const qv = new QVoting(conf, undefined, params);

// Since we are not using the wallet signer feature of the sdk, we will use our QVoting object simply to
// generate the transactions we need. We will then sign and send them ourselves.

// building the contract deploy txs.
// The creation of a new qvote election on the blockchain happens in two steps.
// first the app is created, then the options are added. Adding options can take multiple transactions.
// the 'buildDeployTxs' function returns a tx that creates a new app, and a list of functions that generate addOption txs
// the reason for this is that for the addOption txs to be generated, we need first the appID of the deployed new app
const { appCreateTx, addOptionFns } = await qv.buildDeployTxs();

// sign and send the appCreate tx
const txId = appCreateTx.txID().toString();
const signedTxn = appCreateTx.signTxn(creatorAccount.sk);
await qv.sendSignedTx(signedTxn);
await qv.waitForConfirmation(txId);
const appID = await qv.getAppID();

// Now that we have the appID we can evaluate the addOption functions
const addOptionTxs = addOptionFns.map((f) => f(appID));

// sign and send the addOption txs
// the smart contracts take up to 5 options per addOption tx.
// Because of this, there may be multiple addOption txs to be sent
const signedAddOtionTxs = addOptionTxs.map((tx) =>
  tx.signTxn(creatorAccount.sk)
);
const addOptiontxIDs = addOptionTxs.map((tx) =>
  tx.txID().toString()
);

await Promise.all(
  signedAddOtionTxs.map((tx) => qv.sendSignedTx(tx))
);
await Promise.all(
  addOptiontxIDs.map((txID) => {
      qv.waitForConfirmation(txID);
  })
);

// at this point we can initialize the state of the fully deployed contract with the appID
await qv.initState(appID);
const state = await qv.readGlobalState();
```

### Opt-in 
```typescript
// this time we are not creating a new decision. We need to create a QVoting object that connects to an existing contract.
// we don't pass a wallet becaue we will sign everything ourselves.
// we don't pass params beacuse we aren't deploying a new decision
const qv = new QVoting(conf);
await qv.initState(appID);

// opt int with userAccount
const optInTx = await qv.buildOptInTx(userAccount.addr);
const optInSigned = optInTx.signTxn(userAccount.sk);
await qv.sendSignedTx(optInSigned);
const optInTxID = optInTx.txID().toString();
await qv.waitForConfirmation(optInTxID);

// did opt-in work? User's local storage should have a new qvote credit balance for this appID.
// The balance is based on the amount of ASA specified in the contract that the user has.
const usreBalance = await qv.getUserBalance(userAccount.addr);
```

### Voting
```typescript
const qv = new QVoting(conf);
await qv.initState(appID);

// reading out the inital state to compare
let state = await qv.readGlobalState();

let userBalance = await qv.getUserBalance(userAccount.addr);

// list of options and corresponding credits user wants to spend on them
const options = [
    { optionTitle: "second", creditNumber: 9 },
    { optionTitle: "first", creditNumber: 4 },
];

const voteTxs = await qv.buildVoteTxs(userAccount.addr, options);
const signedVoteTxs = voteTxs.map((tx) =>
    tx.signTxn(userAccount.sk)
);
const voteTxIDs = voteTxs.map((tx) => tx.txID().toString());

await Promise.all(signedVoteTxs.map((tx) => qv.sendSignedTx(tx)));
await Promise.all(
    voteTxIDs.map((txID) => {
        qv.waitForConfirmation(txID);
    })
);

await sleep(20 * 1000)  // indicatively, we have to wait a bit for the algo api to update the results 

state = await qv.readGlobalState();
state.options.map((o) => console.log(o.value.toString()));

userBalance = await qv.getUserBalance(userAccount.addr);
```

### Reading State (results) 
```typescript
const qv  = new QVoting(conf)
await qv.initState(appID)

const globalState = await qv.readGlobalState(); 

const userBalance = await qv.getUserBalance(userAccount.addr);
```
