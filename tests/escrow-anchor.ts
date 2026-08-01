import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowAnchor } from "../target/types/escrow_anchor";
import { BN } from "bn.js";
import { randomBytes } from "crypto";
import { createAssociatedTokenAccountIdempotentInstruction, createInitializeAccount2Instruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

describe("escrow-anchor", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();

  const program = anchor.workspace.escrowAnchor as Program<EscrowAnchor>;

  const tokenProgram = TOKEN_2022_PROGRAM_ID;

  const seed = new BN(randomBytes(8));

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

  const [maker, taker, mintA, mintB] = Array.from({ length: 4 }, () =>
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

    const escrow = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), maker.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];

    const vault = getAssociatedTokenAddressSync(mintA.publicKey, escrow, true, tokenProgram);

    const accounts = {
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
    }

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
        ...[mintA, mintB].map((mint) =>
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
        ]
        .flatMap((x) => [
          createInitializeMint2Instruction(x.mint, 6, x.authority, null, tokenProgram),
          createAssociatedTokenAccountIdempotentInstruction(provider.publicKey, x.ata, x.authority, x.mint, tokenProgram),
          createMintToInstruction(x.mint, x.ata, x.authority, 1e9, undefined, tokenProgram),
        ])
      ];

      await provider.sendAndConfirm(tx, [mintA, mintB, maker, taker]).then(log);
  });


  it("Make", async () => {
    // Add your test here.
    const tx = await program.methods
    .make(seed, new BN(1e6), new BN(1e6))
    .accounts({ ...accounts })
    .signers([maker])
    .rpc()
    .then(confirm)
    .then(log);

    console.log("Makeing of Escrow completed", tx);

  });

  it("Refund", async () => {
    const tx = await program.methods
    .refund()
    .accounts({ ...accounts })
    .signers([maker])
    .rpc()
    .then(confirm)
    .then(log);

    console.log("Refund Completed", tx);
  });

  it("Take", async () => {
    try{
      const tx = await program.methods
        .take()
        .accounts({ ...accounts })
        .signers([taker])
        .rpc()
        .then(confirm)
        .then(log);

    console.log("take confirmed", tx);
    }catch(e){
      console.log(e);
      throw(e);
    };

  });

  after("cleanup event listeners", async () => {
    for (const id of listenerIds) {
      await program.removeEventListener(id);
    }
  });
  

});
