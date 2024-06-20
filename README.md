transactioner is a node service that does something very simple: it sends the minimum amount of solana back and forth between two keys

you can generate two solana keys using `solana-keygen`, and set `.env` to point to them - defaults to `keys/key1.json` and `keys2.json`. must be private json keys, so be careful w/ them and consider them hot wallets (i.e. don't put a ton of sol in them)

this code is super rough!
