import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowAnchor } from "../target/types/escrow_anchor";
import { BN } from "bn.js";
import { randomBytes } from "crypto";
import { createAssociatedTokenAccountIdempotentInstruction, createInitializeAccount2Instruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { assert } from "chai";

describe("escrow-anchor", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();

  const program = anchor.workspace.escrowAnchor as Program<EscrowAnchor>;

  const tokenProgram = TOKEN_2022_PROGRAM_ID;

  // Two escrows: one gets taken, the other gets refunded.
  const seedTake = new BN(randomBytes(8));
  const seedRefund = new BN(randomBytes(8));

  const log = async (signature: string): Promise<string> => {
    console.log(
      `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${provider.connection.rpcEndpoint}`
    );
    return signature;
  };

  const confirm = async (signature: string): Promise<string> => {
    const block = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature,
      ...block,
    });
    return signature;
  };

  const [maker, taker, mintA, mintB, mintC] = Array.from({ length: 5 }, () =>
    Keypair.generate()
  );

  
  
    const [makerAtaA, makerAtaB, takerAtaA, takerAtaB] = [maker, taker]
      .map((a) =>
        [mintA, mintB].map((m) =>
          getAssociatedTokenAddressSync(m.publicKey, a.publicKey, false, tokenProgram)
    )
    )
    .flat();

    // seeds = [b"escrow", maker.key().as_ref(), seed.to_le_bytes().as_ref()],
    const accountsFor = (seed: BN) => {
      const escrow = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), maker.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
        program.programId
      )[0];
      const vault = getAssociatedTokenAddressSync(mintA.publicKey, escrow, true, tokenProgram);
      return {
        maker: maker.publicKey,
        taker: taker.publicKey,
        mintA: mintA.publicKey,
        mintB: mintB.publicKey,
        makerAtaA,
        makerAtaB,
        takerAtaA,
        takerAtaB,
        escrow,
        vault,
        tokenProgram,
      };
    };

    // A third mint the taker owns, used to try paying with the wrong token.
    const takerAtaC = getAssociatedTokenAddressSync(mintC.publicKey, taker.publicKey, false, tokenProgram);
    const makerAtaC = getAssociatedTokenAddressSync(mintC.publicKey, maker.publicKey, false, tokenProgram);

    let listenerIds: number[] = [];

    before(() => {
      const makeListner = program.addEventListener("makeEvent", (event, slot, signature) => {
        console.log("Make Event :", event, "Slot :", slot, "signature:", signature);
      });

      listenerIds.push(makeListner);

      const refundListner = program.addEventListener("refundEvent", (event, slot, signature) => {
        console.log("Refund Event :", event, "Slot :", slot, "signature:", signature);
      });

      listenerIds.push(refundListner);

      const takeListner = program.addEventListener("takeEvent", (event, slot, signature) => {
        console.log("Take Event :", event, "Slot :", slot, "signature:", signature);
      });

      listenerIds.push(takeListner);

    })

    it("Airdrop and create mints", async () => {
      let lamports = await getMinimumBalanceForRentExemptMint(provider.connection);
      let tx = new Transaction();
      tx.instructions = [
        ...[maker, taker].map((account) =>
          SystemProgram.transfer({
            fromPubkey: provider.publicKey,
            toPubkey: account.publicKey,
            lamports: 10 * LAMPORTS_PER_SOL,
          })
        ),
        ...[mintA, mintB, mintC].map((mint) =>
          SystemProgram.createAccount({
            fromPubkey: provider.publicKey,
            newAccountPubkey: mint.publicKey,
            lamports,
            space: MINT_SIZE,
            programId: tokenProgram,
          })
        ),
        ...[
          { mint: mintA.publicKey, authority: maker.publicKey, ata: makerAtaA },
          { mint: mintB.publicKey, authority: taker.publicKey, ata: takerAtaB },
          { mint: mintC.publicKey, authority: taker.publicKey, ata: takerAtaC },
        ]
        .flatMap((x) => [
          createInitializeMint2Instruction(x.mint, 6, x.authority, null, tokenProgram),
          createAssociatedTokenAccountIdempotentInstruction(provider.publicKey, x.ata, x.authority, x.mint, tokenProgram),
          createMintToInstruction(x.mint, x.ata, x.authority, 1e9, undefined, tokenProgram),
        ])
      ];

      await provider.sendAndConfirm(tx, [mintA, mintB, mintC, maker, taker]).then(log);
  });


  it("Make", async () => {
    const tx = await program.methods
      .make(seedTake, new BN(1e6), new BN(1e6))
      .accounts({ ...accountsFor(seedTake) })
      .signers([maker])
      .rpc()
      .then(confirm)
      .then(log);

    console.log("Escrow made", tx);
  });

  it("Take with the wrong mint -> should fail", async () => {
    const wrongMint = {
      ...accountsFor(seedTake),
      mintB: mintC.publicKey,
      takerAtaB: takerAtaC,
      makerAtaB: makerAtaC,
    };
    try {
      await program.methods
        .take()
        .accounts({ ...wrongMint })
        .signers([taker])
        .rpc();
      assert.fail("take with the wrong mint should have been rejected");
    } catch (e) {
      assert.include(String(e), "ConstraintHasOne");
    }
  });

  it("Take", async () => {
    const tx = await program.methods
      .take()
      .accounts({ ...accountsFor(seedTake) })
      .signers([taker])
      .rpc()
      .then(confirm)
      .then(log);

    console.log("Take confirmed", tx);
  });

  it("Make a second escrow", async () => {
    const tx = await program.methods
      .make(seedRefund, new BN(1e6), new BN(1e6))
      .accounts({ ...accountsFor(seedRefund) })
      .signers([maker])
      .rpc()
      .then(confirm)
      .then(log);

    console.log("Second escrow made", tx);
  });

  it("Refund", async () => {
    const tx = await program.methods
      .refund()
      .accounts({ ...accountsFor(seedRefund) })
      .signers([maker])
      .rpc()
      .then(confirm)
      .then(log);

    console.log("Refund completed", tx);
  });

  after("cleanup event listeners", async () => {
    for (const id of listenerIds) {
      await program.removeEventListener(id);
    }
  });
  

});
