require("dotenv").config();
import { QQueue } from "../src";
import { mnemonicToSecretKey } from "algosdk";

(async () => {
    const token = { "X-API-Key": process.env.PURESTAKE_ALGORAND_API };
    const baseServer = "https://testnet-algorand.api.purestake.io/ps2";
    const port = "";
    const conf = { token: token, baseServer: baseServer, port: port };

    const creatorMemo =
        "govern sort toward assume torch develop perfect phrase logic group buyer blue build museum deliver problem veteran speed flight sphere auction cup tonight above insane"
    const creatorAccount = mnemonicToSecretKey(creatorMemo);

    const userMemo =
        "butter umbrella say awful custom goat beyond situate dial defy dice foil heart box network follow warm baby grape taste bridge path core above secret"
    const userAccount = mnemonicToSecretKey(userMemo);

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    
    async function deployNew() : Promise<number> {
        try {
            const qSize = 10; 
            const q = QQueue.newQueue(conf, qSize, creatorAccount.addr);
            const deployTx = await q.buildDeployTx();
            const signedDeployTxn = deployTx.signTxn(creatorAccount.sk)
            await q.sendSignedTx(signedDeployTxn);
            const deployTxID = deployTx.txID().toString();
            await q.waitForConfirmation(deployTxID);

            const appID = await q.getAppID()
            console.log("deployed new queue with appID", appID);

            await q.init(appID)
            return appID;
        } catch (e) {
            console.log(e);
        }
    }

    async function logState(appID: number){
        try {
            const q = QQueue.existingQueue(conf, appID)
            await q.init(appID) 
        } catch(e) {
            console.log(e)
        }
    }

    async function optIn(appID: number){
        try {
            const q = QQueue.existingQueue(conf, appID)
            await q.init(appID) 
            const tx = await q.buildOptinTx(userAccount.addr);
            const signedTx = tx.signTxn(userAccount.sk)
            const txID = tx.txID().toString();
            await q.sendSignedTx(signedTx);
            await q.waitForConfirmation(txID);
            console.log('opted in')
        } catch(e) {
            console.log(e)
        }
    }

    async function push(appID: number) {
        try {
            const q = QQueue.existingQueue(conf, appID)
            await q.init(appID) 


            for (var id=0; id<8; id++){
                const pushTx = await q.buildPushTx(userAccount.addr, id)
                const signedTx = pushTx.signTxn(userAccount.sk)
                const txID = pushTx.txID().toString();
                await q.sendSignedTx(signedTx)
                await q.waitForConfirmation(txID)
                console.log('pushed', id)                
            }

            await q.fetchState()
        } catch(e){
            console.log(e)
        }
    } 

    // TODO test with a lot of pushes on a very large queue 
    
    // await deployNew();
    await logState(15988164);
    // await push(15988164);
})()
