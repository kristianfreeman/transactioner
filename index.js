// require('dotenv').config()

const winston = require("winston");
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "log" }),
  ],
});

const {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Connection,
  Transaction,
  SystemProgram,
} = require("@solana/web3.js");
const fs = require("fs");

function loadKeypairFromFile(filename) {
  const secret = JSON.parse(fs.readFileSync(filename).toString());
  const secretKey = Uint8Array.from(secret);
  return Keypair.fromSecretKey(secretKey);
}

let success = 0;
let total = 0;

const key1 = loadKeypairFromFile("keys/key1.json");
const key2 = loadKeypairFromFile("keys/key2.json");

const priorityFee = 20000;
const waitTime = 10000;

logger.info("Loaded keys.");
logger.info(`keys/key1.json: ${key1.publicKey}`);
logger.info(`keys/key2.json: ${key2.publicKey}`);

logger.info(
  `Configured to wait ${waitTime / 1000} seconds between transactions.`,
);
logger.info(`Running with a priority fee of ${priorityFee} microlamports.`);

async function transferSolana() {
  const rpcUrl = "<NODE_URL>";
  const connection = new Connection(rpcUrl);

  const priorityFeePrice = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: priorityFee,
  });

  while (true) {
    logger.info(`Successful transactions: ${(success / total) * 100}%`);

    try {
      const transaction = new Transaction()
        .add(priorityFeePrice)
        .add(
          SystemProgram.transfer({
            fromPubkey: key1.publicKey,
            toPubkey: key2.publicKey,
            lamports: 1,
          }),
        );

      logger.info("Transferring from key1 to key2...");

      const tx1 = await sendAndConfirmTransaction(connection, transaction, [
        key1,
      ]);
      logger.info(`Completed. TX signature: ${tx1}`);
      logger.info(`Waiting ${waitTime / 1000} seconds...`);

      success++;
      total++;
      logger.info(`Successful transactions: ${(success / total) * 100}%`);

      await new Promise((resolve) => setTimeout(resolve, waitTime));

      const transaction2 = new Transaction()
        .add(priorityFeePrice)
        .add(
          SystemProgram.transfer({
            fromPubkey: key2.publicKey,
            toPubkey: key1.publicKey,
            lamports: 1,
          }),
        );

      logger.info("Transferring from key2 to key1...");

      const tx2 = await sendAndConfirmTransaction(connection, transaction2, [
        key2,
      ]);
      logger.info(`Completed. TX signature: ${tx2}`);
      logger.info(`Waiting ${waitTime / 1000} seconds...`);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      success++;
      total++;
      logger.info(`Successful transactions: ${(success / total) * 100}%`);
    } catch (err) {
      total++;
      logger.warn("Transaction failed");
    }
  }
}

transferSolana();
