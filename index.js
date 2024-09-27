require('dotenv').config()

const os = require("os");
const hostname = process.env.HOSTNAME || os.hostname();
const logFile = process.env.LOG_FILE || "./transactioner.log";

const winston = require("winston");
const logger = winston.createLogger({
  defaultMeta: { hostname },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: logFile }),
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

const key1 = loadKeypairFromFile(process.env.KEY1_PATH);
const key2 = loadKeypairFromFile(process.env.KEY2_PATH);

const priorityFee = Number(process.env.PRIORITY_FEE || 0)
const waitTime = Number(process.env.WAIT_TIME || 10000);

logger.debug("Loaded keys.");
logger.debug(`${process.env.KEY1_PATH}: ${key1.publicKey}`);
logger.debug(`${process.env.KEY2_PATH}: ${key2.publicKey}`);

logger.debug(
  `Configured to wait ${waitTime / 1000} seconds between transactions.`,
);
logger.debug(`Running with a priority fee of ${priorityFee} microlamports.`);

let transactionHistory = [];

function calculateSuccessRate() {
  const currentTime = Date.now();
  const timeWindow = 10 * 60 * 1000; // 10 minutes in milliseconds

  // Filter transactionHistory to only include entries within the last 10 minutes
  transactionHistory = transactionHistory.filter(
    (entry) => currentTime - entry.timestamp <= timeWindow
  );
  const total = transactionHistory.length;
  const successes = transactionHistory.filter((entry) => entry.success).length;
  const successRate = total > 0 ? (successes / total) * 100 : 0;

  // Return as JSON
  return {
    total_transactions: total,
    successful_transactions: successes,
    success_rate: successRate,
    window_minutes: 10,
  };
}

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

      logger.debug("Transferring from key1 to key2...");

      const tx1 = await sendAndConfirmTransaction(connection, transaction, [
        key1,
      ]);
      logger.debug(`Completed. TX signature: ${tx1}`);

      const timestamp1 = Date.now();
      transactionHistory.push({ timestamp: timestamp1, success: true });
      const stats1 = calculateSuccessRate();
      logger.info('Transaction completed', stats1);

      logger.debug(`Waiting ${waitTime / 1000} seconds...`);
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

      logger.debug("Transferring from key2 to key1...");

      const tx2 = await sendAndConfirmTransaction(connection, transaction2, [
        key2,
      ]);
      logger.debug(`Completed. TX signature: ${tx2}`);

      const timestamp2 = Date.now();
      transactionHistory.push({ timestamp: timestamp2, success: true });
      const stats2 = calculateSuccessRate();
      logger.info('Transaction completed', stats2);

      logger.debug(`Waiting ${waitTime / 1000} seconds...`);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } catch (err) {
      logger.warn("Transaction failed");
      logger.warn(err);
      const timestamp = Date.now();
      transactionHistory.push({ timestamp, success: false });
      const stats = calculateSuccessRate();
      logger.info('Transaction completed', stats);
    }
  }
}

transferSolana();
