# escrow-anchor: a token escrow on Solana, built with Anchor

A trustless two-party token swap written in Rust with Anchor. A maker locks up token A and says how much token B they want; any taker who pays that amount of token B gets the token A, in one atomic transaction. It's part of my **Solana from first principles** course: the code here is what we build on camera, line by line.

> **Watch the lessons:** [Part 1: Architecture](https://youtu.be/JiSAgNe14oQ) · [Part 2: Make, Take, Refund in Anchor](https://youtu.be/EPobspAcdNo) · [Part 3: Testing with Surfpool + TypeScript](https://youtu.be/cx_uz2LmAWs)
>
> Full course: [Solana from first principles](https://www.youtube.com/playlist?list=PLRR3UvNYzm00)

By the end you'll understand:

- how a program holds SPL tokens in a vault owned by a PDA
- how one `seed` lets a single maker open many escrows at once
- why every account a user passes in has to be checked against stored state (`has_one`)
- how to close token accounts and program accounts and return the rent
- how to test the whole flow against a local validator (Surfpool), including Token-2022

## What the program does

| Instruction | Who calls it | What it does |
| --- | --- | --- |
| `make(seed, deposit_amt, receive_amt)` | maker | Creates the escrow, moves `deposit_amt` of token A into the vault, records that the maker wants `receive_amt` of token B |
| `take()` | taker | Pays `receive_amt` of token B to the maker, receives all of token A from the vault, closes the vault and the escrow |
| `refund()` | maker | Takes token A back out of the vault and closes the vault and the escrow |

Each instruction emits an event (`MakeEvent`, `TakeEvent`, `RefundEvent`) so indexers and frontends can follow offers.

## Accounts

```
Escrow PDA     seeds = ["escrow", maker, seed (u64 LE)]   stores maker, mint_a, mint_b, receive_amt, bump
 └─ vault      ATA(mint_a, owner = Escrow)                 holds the maker's token A
```

- **Escrow** remembers the terms of the deal. The `seed` lets one maker run many escrows side by side.
- **Vault** is the escrow's associated token account for token A. Only the program can move tokens out, by signing with the escrow's seeds.
- Accounts use `TokenInterface`, so the same program works with both the classic Token program and Token-2022 (the tests use Token-2022).

## The checks that make it safe

`take` is called by a stranger, so it can't trust any account it's given. The escrow account checks:

```rust
#[account(
    mut,
    close = maker,
    has_one = maker,
    has_one = mint_a,
    has_one = mint_b,
    seeds = [b"escrow", maker.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
    bump = escrow.bump,
)]
pub escrow: Account<'info, Escrow>,
```

`has_one = mint_b` is the important one. Without it, a taker could pass in a worthless token they minted themselves as `mint_b`, "pay" with it, and still walk away with the maker's token A. The test suite includes this attack and expects it to fail.

## Run it

Prerequisites: Rust, the Solana CLI, Anchor, Node.js + Yarn, and [Surfpool](https://surfpool.run).

```bash
git clone https://github.com/princedotrs/escrow-anchor.git
cd escrow-anchor
yarn install
anchor build

# terminal 1: local validator
surfpool start

# terminal 2: run the tests
anchor test --skip-local-validator
```

The test suite (`tests/escrow-anchor.ts`) creates three Token-2022 mints, then: makes an escrow, tries to take it with the wrong mint (rejected), takes it properly, makes a second escrow and refunds it. Event listeners print each emitted event.

## Project layout

```
programs/escrow-anchor/src/
├── lib.rs              # instruction entry points
├── state.rs            # Escrow account
├── events.rs           # MakeEvent, TakeEvent, RefundEvent
└── instructions/
    ├── make.rs
    ├── take.rs
    └── refund.rs
tests/escrow-anchor.ts  # end-to-end tests
```

## Ideas to extend it

- Add an expiry, after which only `refund` works
- Let the maker name a specific taker
- Allow partial fills, where a taker buys part of the offer

## License

MIT
