use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::{
    self,     
    Mint, 
    MintTo,
    SetAuthority,
    TokenAccount,
    Transfer
    };
use spl_token::instruction::AuthorityType;

use std::str::FromStr;



declare_id!("EJvFwWhUFJdniQyK3JXkz5iBVzyMCHpp7qCSJbDn1UZ6");

   
#[account]
pub struct CollectionAccount {  
    pub owner: Pubkey,
    pub authority: Pubkey,
    pub active: bool, 
    pub reward_period: u64,
    pub last_reward_time: u64,
    pub reward_value: u64,
    pub fee_value: u64,
    pub val_for_fee_exempt: u64,
    pub val_for_closing: u64,
    pub contributed_amount: u64,
    pub donated_amount:u64,
    //pub don_collection: u64,
    
}
/*
////methods
//init
//donate (with referer reward )
//withdrow donations
//withdraw commisions for owner
//reward donators (top 10 for entire platworm)
//stop by initiator
//close collection
//contribute tokens to fee exemption
*/

fn fee_calculation ( &fee_value: &u64, &amount: &u64)-> u64 {
    
    let mut fee_amount = (fee_value * amount)/100;
    let reminder = (fee_value * amount)%100;
                
        if reminder!=0{
            if ((amount * 10 )/reminder) > 4 {
                fee_amount+=1;
            } 
        }
     fee_amount       
}

fn reward_calculation ( &reward_value: &u64, &amount: &u64)-> u64 {
    //TODO:lamportspersol
    let mut reward_amount = 1000*(reward_value * amount)/1000000000;
    let reminder = 1000*(reward_value * amount)%1000000000;
                
        if reminder!=0{
            if ((amount * 10 )/reminder) > 4 {
                reward_amount+=1;
            } 
        }
    reward_amount       
}

#[program]
pub mod donations {
    use super::*;
    
    const COLLECTION_PDA_SEED: &[u8] = b"collection";
    const OWNER_ACCOUNT: &str = "4LnHwNdQCBEV9YHQtjz5oPYjZiJu7WYsFx9RGvTZmxYT";
    
    
    
    //intialize system    
    pub fn initialize_system(
        ctx: Context<InitializeSystem>,          
    ) -> Result<()> {
        
        
        let (vault_authority, _vault_authority_bump) =
            Pubkey::find_program_address(
                &[COLLECTION_PDA_SEED],
                ctx.program_id
            );            
        
        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(vault_authority),
        )?;
        
        token::set_authority(
            ctx.accounts.into_mint_set_authority_context(),
            AuthorityType::MintTokens,
            Some(vault_authority),
        )?;
        
        Ok(())
    }
    
    
    //initialize collection
    
    pub fn initialize(
        ctx: Context<Initialize>,  
        authority: Pubkey,
        reward_period: u64,
        reward_value: u64,
        fee_value: u64,
        val_for_fee_exempt: u64,       
        val_for_closing: u64,
        
    ) -> Result<()> {
        
        //ctx.accounts.collection_account.allowance = false;       
        
        let owner_account_saved = Pubkey::from_str(OWNER_ACCOUNT)
                .expect("Unknown owner Account coded in smartcontract");
                
        require!(ctx.accounts.owner_account.key()==
                owner_account_saved,
                MyError::UnknownOwner );
        ctx.accounts.collection_account.authority = authority;
        ctx.accounts.collection_account.owner = ctx.accounts.owner_account.key();
       
        ctx.accounts.collection_account.active = true;
        ctx.accounts.collection_account.reward_period = reward_period;
        
        let now_ts = Clock::get().unwrap().slot;
        ctx.accounts.collection_account.last_reward_time = now_ts;
        
        ctx.accounts.collection_account.reward_value = reward_value;        
        
        ctx.accounts.collection_account.fee_value = fee_value;
        
        //move to initial script or harcode this
        ctx.accounts.collection_account.val_for_fee_exempt = val_for_fee_exempt;
        
        ctx.accounts.collection_account.val_for_closing = val_for_closing;
        ctx.accounts.collection_account.contributed_amount = 0;
        ctx.accounts.collection_account.donated_amount = 0;
        
        /*
        let (vault_authority, _vault_authority_bump) =
            Pubkey::find_program_address(
                &[COLLECTION_PDA_SEED],
                ctx.program_id
            );            
        
        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(vault_authority),
        )?;
        
        token::set_authority(
            ctx.accounts.into_mint_set_authority_context(),
            AuthorityType::MintTokens,
            Some(vault_authority),
        )?;
        */
        Ok(())
    }
    
    //Donate SOL to collection vault
    pub fn donate( 
        ctx: Context<Donate>,        
        amount: u64,        
        ) -> Result<()>   {
        //Check that collection is not closed
        require!(ctx.accounts.collection_account.active, MyError::CollectionIsInactive);
        
        //Check that donate amount is more then 0 lamports        
        require!(amount > 0, MyError::AmountTooSmall);        
        
        let fee_amount=
            fee_calculation(
                &ctx.accounts.collection_account.fee_value,
                &amount
            );   
            
        msg!("Fee is {} lamports for amount {}", fee_amount, amount);
            
        //Check that donor have enouph lamports for donate  
        if **ctx.accounts.donor.try_borrow_lamports()? < amount + fee_amount  {
            return Err(error!(MyError::InsufficientFundsForTransaction));
        }
        
        let owner_account_saved = Pubkey::from_str(OWNER_ACCOUNT)
                .expect("Unknown Owner Account coded in smartcontract");
                
        require!(ctx.accounts.owner_account.key()==
                owner_account_saved,
                MyError::FeeToUnknown );
        
        //Transfer donate amount
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.donor.key(),
            &ctx.accounts.vault_sol_account.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.vault_sol_account.to_account_info(),
            ],
        )?;  
        
        ctx.accounts.collection_account.donated_amount += amount;
        
        //Transfer fee if collection have lower then exemption value
        if ctx.accounts.collection_account.val_for_fee_exempt> ctx.accounts.collection_account.contributed_amount {
            let ix_fee = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.donor.key(),
                &ctx.accounts.owner_account.key(),
                fee_amount,
            );
            anchor_lang::solana_program::program::invoke(
                &ix_fee,
                &[
                    ctx.accounts.donor.to_account_info(),
                    ctx.accounts.owner_account.to_account_info(),
                ],
            )?;
        }
        
        //Calculate mint authority
        let (_vault_authority, vault_authority_bump) =
            Pubkey::find_program_address(&[COLLECTION_PDA_SEED],
                    ctx.program_id);
        let authority_seeds = &[&COLLECTION_PDA_SEED[..],
            &[vault_authority_bump]];
        
        //Calculate reward amount
        let reward_amount = reward_calculation(&101, &amount);
        
        msg!("Reward amount is {} CHRT*1000 for amount {}", reward_amount, amount);
        
        
        //Transfer CHRT rewards to donor acoount       
        token::mint_to(
                ctx.accounts.into_mint_to_donor_context()
                .with_signer(&[&authority_seeds[..]]),
                reward_amount,
        )?;      
             
        Ok(())
    }
    
    
    //withdrow donations to donator
    pub fn withdraw_donations( 
        ctx: Context<WithdrawDonations>,        
        amount: u64,        
        ) -> Result<()>   {
        
        //Check that collection is not closed
        //require!(ctx.accounts.collection_account.active, MyError::CollectionIsInactive);
        
        //Check that transfer amount is more then 0 tokens        
        require!(amount > 0, MyError::AmountTooSmall);
        
        if **ctx.accounts
            .vault_sol_account
            .try_borrow_lamports()? < amount  {
            return Err(error!(MyError::InsufficientFundsForTransaction));
        }
        
        
       /* let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.vault_sol_account.key(),
            &ctx.accounts.authority.key(),
            amount,
        );
        
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.vault_sol_account.to_account_info(),
                ctx.accounts.authority.to_account_info(),
            ],
        )?;
        */
        
        // Debit vault_sol_account and credit recepient accounts
        **ctx.accounts.vault_sol_account.try_borrow_mut_lamports()? -= amount ;
        **ctx.accounts.authority.try_borrow_mut_lamports()? += amount;  
        
        
        Ok(())
    }
    
    pub fn stop_collection( 
        ctx: Context<StopCollection>,  
        ) -> Result<()>   {
        
        //Check that collection is not closed
        require!(ctx.accounts.collection_account.active, MyError::CollectionIsInactive);
        
        ctx.accounts.collection_account.active=false;
        
        Ok(())
    }
    
    //Contribute tokens to the collection
    pub fn contribute_tokens( 
        ctx: Context<ContributeTokens>,        
        amount: u64,        
        ) -> Result<()>   {
        //Check that collection is not closed
        require!(ctx.accounts.collection_account.active, MyError::CollectionIsInactive);
        
        //Check that transfer amount is more then 0 tokens 
        require!(amount > 0, MyError::AmountTooSmall);
        
        msg!("Amount of tokens user have on account {}",
            ctx.accounts.contributor_token_account.amount);
            
        //Check that user have enouph tokens for transfer
        require!(ctx.accounts.contributor_token_account.amount >= amount, MyError::InsuficientUserFunds);
        
        
        //Transfer user's tokens to treasury acoount
        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            amount,
        )?;
        
        //Increase collection contribution counter for amount
        ctx.accounts.collection_account.contributed_amount+=amount;   
        
        if amount==ctx.accounts.collection_account.val_for_closing {
            msg!("User contributed especial for closing the collection number of tokens {}", amount);
            ctx.accounts.collection_account.active = false;
        }
        
        
        Ok(())
    }
    
    
    
    /*
    //set fee value in percents
    pub fn set_fee( 
        ctx: Context<SetFee>,          
        value: u64,        
        ) -> Result<()>   {
        
        //Check that fee percent amount betwen  0 and 100  tokens
        require!(value <= 100, MyError::FeeTooLarge);
        require!(value >= 0, MyError::FeeTooSmall);
        
        ctx.accounts.wallet_account.fee_value = value;
        
        Ok(())
    }
    
    //Transfer SOL to smart contract
    pub fn transfer_sol_from( 
        ctx: Context<TransferSOLFrom>,        
        amount: u64,        
        ) -> Result<()>   {
        
        //Check that transfer amount is more then 0 tokens        
        require!(amount > 0, MyError::AmountTooSmall);        
        
        let fee_amount=
            fee_calculation(
                &ctx.accounts.wallet_account.fee_value,
                &amount
            );   
            
        //Check that user have enouph lamports for transfer  
        if **ctx.accounts.user.try_borrow_lamports()? < amount  {
            return Err(error!(MyError::InsufficientFundsForTransaction));
        }
        
        let fee_account_saved = Pubkey::from_str(FEE_ACCOUNT)
                .expect("Unknown Account coded in smartcontract");
                
        require!(ctx.accounts.fee_account.key()==
                fee_account_saved,
                MyError::FeeToUnknown );
        
        //Transfer amount
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault_sol_account.key(),
            amount - fee_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault_sol_account.to_account_info(),
            ],
        )?;        
        
        //Transfer fee
        let ix_fee = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.fee_account.key(),
            fee_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix_fee,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.fee_account.to_account_info(),
            ],
        )?;
        
        Ok(())
    }
    
    //transfer SOL to recepient
    pub fn transfer_sol_to( 
        ctx: Context<TransferSOLTo>,        
        amount: u64,        
        ) -> Result<()>   {
        
        //Check that transfer amount is more then 0 tokens        
        require!(amount > 0, MyError::AmountTooSmall);
        
        let fee_account_saved = Pubkey::from_str(FEE_ACCOUNT)
                .expect("Unknown Account coded in smartcontract");
                
        require!(ctx.accounts.fee_account.key()==
                fee_account_saved,
                MyError::FeeToUnknown );        
        
        let fee_amount=
            fee_calculation(
                &ctx.accounts.wallet_account.fee_value,
                &amount
            );
        
        if **ctx.accounts
            .vault_sol_account
            .try_borrow_lamports()? < amount  {
            return Err(error!(MyError::InsufficientFundsForTransaction));
        }
        // Debit vault_sol_account and credit recepient and fee accounts
        **ctx.accounts.vault_sol_account.try_borrow_mut_lamports()? -= amount ;
        **ctx.accounts.recepient.try_borrow_mut_lamports()? += amount - fee_amount;  
        **ctx.accounts.fee_account.try_borrow_mut_lamports()? += fee_amount;
        
        Ok(())
    }
    
    //Transfer tokens to smart contract
    pub fn transfer_from( 
        ctx: Context<TransferFrom>,        
        amount: u64,        
        ) -> Result<()>   {
        
        //Check that transfer amount is more then 0 tokens 
        require!(amount > 0, MyError::AmountTooSmall);
        
        msg!("Amount of tokens user have on account {}",
            ctx.accounts.user_deposit_token_account.amount);
            
        //Check that user have enouph tokens for transfer
        require!(ctx.accounts.user_deposit_token_account.amount >= amount, MyError::InsuficientUserFunds);
        
        
        //Transfer user's tokens to treasury acoount
        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            amount,
        )?;
        
        Ok(())
    }
    
    //Transfer tokens to recepient
    pub fn transfer_to( 
        ctx: Context<TransferTo>,        
        amount: u64,        
        ) -> Result<()>   {
        
        //Check that transfer amount is more then 0 tokens 
        require!(amount > 0, MyError::AmountTooSmall);
                            
        //Check that wallet have enouph tokens for transfer
        require!(ctx.accounts.vault_account.amount >= amount, MyError::InsuficientWallet);
        
        //Calculate wallet authority
        let (_vault_authority, vault_authority_bump) =
            Pubkey::find_program_address(&[WALLET_PDA_SEED],
                    ctx.program_id);
        let authority_seeds = &[&WALLET_PDA_SEED[..],
            &[vault_authority_bump]];
        
        //Transfer wallets tokens to user acoount       
       token::transfer(
                ctx.accounts.into_transfer_to_user_context()
                .with_signer(&[&authority_seeds[..]]),
                amount,
        )?;        
        
        Ok(())
    }
    
    //allow to recepient
    pub fn allow_to( 
        ctx: Context<AllowTo>,          
        amount: u64,        
        ) -> Result<()>   {
                
        //Check that transfer amount is more then 0 tokens 
        require!(amount > 0, MyError::AmountTooSmall);
            
        //Check that user have enouph tokens for the bet
        require!(ctx.accounts.vault_account.amount >= amount, MyError::InsuficientWallet);
        
         ctx.accounts.wallet_account.recepient = 
            *ctx.accounts.recepient.to_account_info().key;
         ctx.accounts.wallet_account.allowance_value = 
            amount;
         ctx.accounts.wallet_account.allowance = true;
                
        Ok(())
    }    
    
    //Take allowance by the recepient
    pub fn take_allowance( 
        ctx: Context<TakeAllowance>,
        ) -> Result<()>   {
        
        require!(ctx.accounts.wallet_account.allowance ==
                true,
                MyError::ForbidedAllowanceTaking );
                
         //Calculate wallet authority
        let (_vault_authority, vault_authority_bump) =
            Pubkey::find_program_address(&[WALLET_PDA_SEED],
                    ctx.program_id);
        let authority_seeds = &[&WALLET_PDA_SEED[..],
            &[vault_authority_bump]];
        
        //Transfer wallets tokens to user acoount       
       token::transfer(
                ctx.accounts.into_transfer_allowance_context()
                .with_signer(&[&authority_seeds[..]]),
                ctx.accounts.wallet_account.allowance_value,
        )?;        
       
         ctx.accounts.wallet_account.allowance_value = 0;
         ctx.accounts.wallet_account.allowance = false;        
        
        Ok(())
    }
    */
       
}


#[derive(Accounts)]
pub struct InitializeSystem<'info> {
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(
        init,
        seeds = [b"sol-seed".as_ref()],        
        payer = initializer,
        bump,
        space = 8 + 8,
    )]
    pub vault_sol_account: AccountInfo<'info>,
    //TODO: move mint authority
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut, signer)]
    pub mint_authority: AccountInfo<'info>,
    #[account(
        init,
        seeds = [b"token-seed".as_ref()],
        bump,
        payer = initializer,
        token::mint = mint,
        token::authority = initializer,
    )]
    pub vault_account: Account<'info, TokenAccount>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: AccountInfo<'info>,  
    pub rent: Sysvar<'info, Rent>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    
}


impl<'info> InitializeSystem<'info> {
    
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.vault_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
    
    fn into_mint_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.mint.to_account_info().clone(),
            current_authority: self.mint_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

 

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub owner_account:AccountInfo<'info>,
    #[account(zero)]
    pub collection_account: Box<Account<'info, CollectionAccount>>,
    /*//TODO: try one vault for tokens and sol or move authority to pda too
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(
        init,
        seeds = [b"sol-seed".as_ref()],        
        payer = initializer,
        bump,
        space = 8 + 8,
    )]
    pub vault_sol_account: AccountInfo<'info>,
    //TODO: move mint authority
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut, signer)]
    pub mint_authority: AccountInfo<'info>,
    #[account(
        init,
        seeds = [b"token-seed".as_ref()],
        bump,
        payer = initializer,
        token::mint = mint,
        token::authority = initializer,
    )]
    pub vault_account: Account<'info, TokenAccount>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: AccountInfo<'info>,  
    pub rent: Sysvar<'info, Rent>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    
    */
    
}



#[derive(Accounts)]
pub struct Donate<'info> {   
    //#[account()]
    pub collection_account: Box<Account<'info, CollectionAccount>>,     
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub donor: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>,   
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub owner_account: AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub referer_token_account : AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub vault_authority: AccountInfo<'info>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,   
}

impl<'info> Donate <'info> {
    fn into_mint_to_donor_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.mint.to_account_info().clone(),
            to: self
                .referer_token_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
        
}



#[derive(Accounts)]
pub struct WithdrawDonations<'info> {
        
    #[account(has_one = authority)]
    pub collection_account: Box<Account<'info, CollectionAccount>>, 
    #[account(mut)]
    pub authority: Signer<'info>,         
    
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>, 
    
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,     
}


#[derive(Accounts)]
pub struct StopCollection<'info> {        
    #[account(mut, has_one = authority)]
    pub collection_account: Box<Account<'info, CollectionAccount>>, 
    #[account(mut)]
    pub authority: Signer<'info>,         
}


#[derive(Accounts)]
pub struct ContributeTokens<'info> {
        
    #[account(mut)]
    pub collection_account: Box<Account<'info, CollectionAccount>>,      
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub contributor: AccountInfo<'info>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,    
    #[account(mut)]
    pub contributor_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,       
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}


impl<'info> ContributeTokens<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .contributor_token_account
                .to_account_info()
                .clone(),
            to: self.vault_account.to_account_info().clone(),
            authority: self.contributor.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
    
}



/*
#[derive(Accounts)]
pub struct SetFee<'info> {        

    #[account(mut, has_one = authority)]
    pub wallet_account: Box<Account<'info, WalletAccount>>, 
    pub authority: Signer<'info>,
}


#[derive(Accounts)]
pub struct TransferSOLFrom<'info> {   

    #[account()]
    pub wallet_account: Box<Account<'info, WalletAccount>>,     
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub user: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>,   
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub fee_account: AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,       
    
}


#[derive(Accounts)]
pub struct TransferSOLTo<'info> {
        
    #[account(mut, has_one = authority)]
    pub wallet_account: Box<Account<'info, WalletAccount>>, 
    pub authority: Signer<'info>,         
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub recepient: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>, 
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub fee_account: AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,       
    
}

#[derive(Accounts)]
pub struct TransferFrom<'info> {
        
    #[account(mut)]
    pub wallet_account: Box<Account<'info, WalletAccount>>,      
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub user: AccountInfo<'info>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,    
    #[account(mut)]
    pub user_deposit_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,       
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}


impl<'info> TransferFrom<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .user_deposit_token_account
                .to_account_info()
                .clone(),
            to: self.vault_account.to_account_info().clone(),
            authority: self.user.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
    
}


#[derive(Accounts)]
pub struct TransferTo<'info> {
        
    #[account(mut, has_one = authority )]
    pub wallet_account: Box<Account<'info, WalletAccount>>,      
    /// CHECK: This is not dangerous because we don't read or write from this account    
    pub authority: Signer<'info>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub vault_authority: AccountInfo<'info>,    
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_deposit_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,       
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,   
    
}

impl<'info> TransferTo<'info> {
    fn into_transfer_to_user_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_account.to_account_info().clone(),
            to: self
                .user_deposit_token_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
        
}

#[derive(Accounts)]
pub struct AllowTo<'info> {
        
    #[account(mut, has_one = authority)]
    pub wallet_account: Box<Account<'info, WalletAccount>>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub recepient: AccountInfo<'info>,  
    
}


#[derive(Accounts)]
pub struct TakeAllowance<'info> {
        
    #[account(mut, has_one = recepient)]
    pub wallet_account: Box<Account<'info, WalletAccount>>,      
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub recepient_account: Account<'info, TokenAccount>,
    pub recepient: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub vault_authority: AccountInfo<'info>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,    
     /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,       
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    
}


impl<'info> TakeAllowance<'info> {
    fn into_transfer_allowance_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_account.to_account_info().clone(),
            to: self
                .recepient_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
        
}
*/

#[error_code]
pub enum MyError {    
    #[msg("Program may only accept donates or contributions more then 0")]
    AmountTooSmall,
    #[msg("Program can set Fee less then 100%")]
    FeeTooLarge,
    #[msg("Program can set Fee more then 0%")]
    FeeTooSmall,
    #[msg("User dont have enouph CHRS for the contribution")]
    InsuficientUserFunds,
    #[msg("The wallet does not respond amount for transfer")]
    InsuficientWallet,    
    #[msg("The provided owner account is unknown")]
    UnknownOwner,    
    #[msg("Transfer is not authorized by wallet owner")]
    UnauthorizedTransfer,
    #[msg("Transfer is not allowed or already taken")]
    ForbidedAllowanceTaking,
    #[msg("There is not enougph SOL to make an operation")]
    InsufficientFundsForTransaction,
    #[msg("Provided unknown owner account")]
    FeeToUnknown,
    #[msg("Program does not works with inactive collections")]
    CollectionIsInactive,
   
}

