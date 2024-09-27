require('dotenv').config()

const os = require("os");

const winston = require("winston");
const logger = winston.createLogger({
  defaultMeta: { hostname },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "log" }),
  ],
});

const {
  ComputeBudgetProgram,
  Keypair,
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

const hostname = process.env.HOSTNAME || os.hostname();

const key1 = loadKeypairFromFile(process.env.KEY1_PATH);
const key2 = loadKeypairFromFile(process.env.KEY2_PATH);

const priorityFee = Number(process.env.PRIORITY_FEE || 0)
const waitTime = Number(process.env.WAIT_TIME || 10000);

logger.info("Loaded keys.");
logger.info(`${process.env.KEY1_PATH}: ${key1.publicKey}`);
logger.info(`${process.env.KEY2_PATH}: ${key2.publicKey}`);

logger.info(
  `Configured to wait ${waitTime / 1000} seconds between transactions.`,
);
logger.info(`Running with a priority fee of ${priorityFee} microlamports.`);

async function transferSolana() {
  const rpcUrl = process.env.RPC_URL;
  const connection = new Connection(rpcUrl);

  const priorityFeePrice = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: priorityFee,
  });

  while (true) {
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
      logger.info(
        `Successful transactions (last 10min): ${(success / total) * 100}%`,
      );

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
      logger.info(
        `Successful transactions (last 10min): ${(success / total) * 100}%`,
      );
    } catch (err) {
      total++;
      logger.warn("Transaction failed");
      logger.warn(err);
    }
  }
}

transferSolana()
