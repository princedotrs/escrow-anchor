# Escrow-Anchor

A Solana Anchor-based program implementing a token escrow system.

## Overview

Escrow-Anchor is a smart contract (on Solana, using the Anchor framework) that facilitates a trustless escrow between two parties exchanging different tokens. It allows a "maker" to deposit tokens into escrow, specify what they want in return, and a "taker" to fulfill the other side of the trade. The contract manages the funds and ensures that tokens are exchanged atomically or refunded if the deal is not completed.

## Features

- **Initialize Escrow**: The maker deposits token A into escrow, specifying the amount and the token B they wish to receive.
- **Atomic Exchange**: The taker deposits token B; the contract swaps tokens between parties, ensuring both sides are fully satisfied or the transaction fails.
- **Refund Option**: If the deal is not finalized, the maker can refund their tokens from escrow.
- **Event Emissions**: Emits events (`MakeEvent`, `TakeEvent`, `RefundEvent`) for on-chain monitoring and integration.

## How It Works

1. **Make**: The maker calls the `make` instruction, depositing a specified amount of token A and specifying how much token B they want in return. An escrow account is initialized to store state and funds.
   
2. **Take**: The taker calls the `take` instruction, depositing the required amount of token B. Upon success, token A is sent from escrow to the taker, and token B is sent to the maker. The escrow vault is closed.

3. **Refund**: If no taker fulfills the offer, the maker can call `refund` to retrieve their token A from escrow and close the vault.

### Main Data Structure

```rust
pub struct Escrow {
    pub seed: u64,
    pub maker: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub receive_amt: u64,
    pub bump: u8,
}
```

## Usage

### Clone the Repo

```bash
git clone https://github.com/prince981620/escrow-anchor.git
cd escrow-anchor
```

### Install Dependencies

```bash
yarn install
```

### Build the Project

```bash
anchor build
```

### Test the Project

```bash
anchor test
```

## Example Flow

- **Airdrop and mint tokens** for maker and taker accounts.
- Maker creates escrow by calling `make`, funds are deposited.
- Taker fulfills the deal by calling `take`, token swap occurs.
- If no taker, maker can call `refund` to reclaim their tokens.

## Key Files

- `programs/escrow-anchor/src/lib.rs`: Anchor program logic and instruction definitions.
- `programs/escrow-anchor/src/instructions/`: Individual instruction handlers (`make`, `take`, `refund`).
- `programs/escrow-anchor/src/state.rs`: Escrow account state.
- `tests/escrow-anchor.ts`: Integration tests covering end-to-end flows.

## Events

- `MakeEvent`: Emitted when escrow is created.
- `TakeEvent`: Emitted when escrow is completed by taker.
- `RefundEvent`: Emitted when maker refunds their tokens.

## Requirements

- Node.js, Yarn
- Solana CLI tools
- Anchor CLI

## License

MIT

---

For more details, see the program code and the test suite.
