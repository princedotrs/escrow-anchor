use anchor_lang::prelude::*;


pub mod instructions;
pub mod state;
pub mod events;

pub use instructions::*;
pub use state::*;
pub use events::*;

declare_id!("8uravPHmsEby816j2dwkjN7Qxcw9FwFGtnnv9pov4L4g");

#[program]
pub mod escrow_anchor {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, deposit_amt: u64,receive_amt: u64) -> Result<()> {
        ctx.accounts.deposit(deposit_amt)?;
        ctx.accounts.init_escrow(seed,receive_amt, &ctx.bumps)?;

        emit!(MakeEvent {
            maker: ctx.accounts.maker.key(),
            mint_a: ctx.accounts.mint_a.key(),
            mint_b: ctx.accounts.mint_b.key(),
            deposit_amt,
            receive_amt
        });

        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.refund_and_close_vault()?;
        emit!(RefundEvent {
            maker: ctx.accounts.maker.key(),
            mint_a: ctx.accounts.mint_a.key(),
        });

        Ok(())
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        ctx.accounts.transfer_to_maker()?;
        ctx.accounts.withdraw_and_close_vault()?;

        emit!(TakeEvent {
            maker: ctx.accounts.maker.key(),
            taker: ctx.accounts.taker.key(),
            mint_a: ctx.accounts.mint_a.key(),
            mint_b: ctx.accounts.mint_b.key(),
            receive_amt: ctx.accounts.escrow.receive_amt,
        });

        
        Ok(())
    }

}

