/*
In this example we will show how to use QVote without any signer. 
This could be used to use a signer not already integrated in the sdk. 
*/

require("dotenv").config();
import { QVoting } from "../src";
import algosdk, { mnemonicToSecretKey } from "algosdk";

(async () => {
    const token = { "X-API-Key": process.env.PURESTAKE_ALGORAND_API };
    const baseServer = "https://testnet-algorand.api.purestake.io/ps2";
    const port = "";
    const conf = { token: token, baseServer: baseServer, port: port };

    const creatorMemo =
        "outside narrow athlete skill around soccer win canoe october knife situate treat remain insect police clown clutch buyer angle page scout job impact able ecology";
    const creatorAccount = mnemonicToSecretKey(creatorMemo);

    const userMemo =
        "universe cabbage park social now address more amazing stem old toddler climb conduct table topple engine avoid outdoor forum fetch glance blast estate abstract select";

    const userAccount = mnemonicToSecretKey(userMemo);

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    async function deployNew() {
        try {
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
            console.log("txID", txId);
            const signedTxn = appCreateTx.signTxn(creatorAccount.sk);
            console.log("Signed transaction with txID: %s", txId);
            await qv.sendSignedTx(signedTxn);
            console.log("SENT");
            await qv.waitForConfirmation(txId);
            const appID = await qv.getAppId();
            console.log("deployed new contract with appID", appID);

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
            console.log(state);

            return appID;
        } catch (e) {
            console.log(e);
        }
    }

    async function optIn(appID: number) {
        try {
            // this time we are not creating a new decision. We need to create a QVoting object that connects to an existing contract.
            // we don't pass a wallet becaue we will sign everything ourselves.
            // we don't pass params beacuse we aren't deploying a new decision
            const qv = new QVoting(conf);
            await qv.initState(appID);

            // opt int with useAccount
            const optInTx = await qv.buildOptInTx(userAccount.addr);
            const optInSigned = optInTx.signTxn(userAccount.sk);
            await qv.sendSignedTx(optInSigned);
            const optInTxID = optInTx.txID().toString();
            await qv.waitForConfirmation(optInTxID);
            console.log("sent optin tx, checking if it worked");

            // did opt-in work? User's local storage should have a new qvote credit balance for this appID.
            // The balance is based on the amount of ASA specified in the contract that the user has.
            const usreBalance = await qv.getUserBalance(userAccount.addr);
            console.log("STORAGE");
            console.log(usreBalance);
        } catch (e) {
            console.log(e);
        }
    }

    async function vote(appID: number) {
        try {
            const qv = new QVoting(conf);
            await qv.initState(appID);

            // reading out the inital state to compare
            let state = await qv.readGlobalState();
            console.log("STATE", state);

            let userBalance = await qv.getUserBalance(userAccount.addr);
            console.log("userBalance");
            console.log(userBalance);

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

            console.log("signed and sent all vote txs");

            // we need to wait a sec to get the updated values from the api 
            await sleep(5 * 1000); 
            state = await qv.readGlobalState();
            state.options.map((o) => console.log(o.value.toString()));
            console.log("STATE", state);

            userBalance = await qv.getUserBalance(userAccount.addr);
            console.log("userBalance");
            console.log(userBalance);
        } catch (e) {
            console.log(e);
        }
    }

    async function logState(appID : number){
        const qv  = new QVoting(conf)
        await qv.initState(appID)

        const globalState = await qv.readGlobalState(); 
        console.log(globalState)

        const userBalance = await qv.getUserBalance(userAccount.addr);
        console.log("userBalance");
        console.log(userBalance);
    }

    console.log("starting deploy");
    const appID = await deployNew();

    console.log("starting optin");
    await optIn(appID);

    console.log("waiting 40 seconds");
    await sleep(40 * 1000);

    console.log("starting vote");
    await vote(appID);

    await logState(appID);

})();
