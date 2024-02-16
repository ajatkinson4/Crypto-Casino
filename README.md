# Crypto-Casino #

## Overview ##
Crypto Casino is a cutting-edge web application that revolutionizes online gaming by integrating cryptocurrency transactions directly into the casino experience. Built with express.js, this platform offers a seamless, secure, and engaging environment for users to enjoy their favorite casino games while managing transactions through Coinbase APIs and crypto technologies.

## Key Features ##
**Cryptocurrency Integration:** Utilize Coinbase for secure cryptocurrency transactions, allowing players to buy credits, win and withdraw credits, and manage their funds efficiently.

**Secure User Authentication:** Incorporates bcrypt for hashing passwords, ensuring robust security for user accounts.

**Session Management:** Leverages express-session for handling user sessions, maintaining a secure and personalized experience.

**Dynamic Game Play:** Features a variety of casino games including slot machines, blackjack, and roulette, all refactored to interact with the backend for real-time credit management.

## Technologies Used ##
**Express:** As the backbone framework for the web application.

**Coinbase:** For handling cryptocurrency transactions.

**MongoDB:** For schema-based data modeling and database management.

## Getting Started ##
Before you begin, ensure you have Node.js installed on your system. Then, follow these steps to get your Crypto Casino up and running:

### Clone the Repository ###
```
git clone <repository-url>
cd Crypto-Casino
```

### Install Dependencies ###
```
npm install
```

### Configure Environment Variables ###
Create a .env file in the root directory and configure your database URI, session secret, Coinbase API key, and other necessary environment variables.

### Start the Application ###
```
npm start
```
Your Crypto Casino app should now be running on http://localhost:3000.

## Usage
**Creating an Account:** Navigate to the homepage and sign up using a valid email and username. Your password will be securely hashed and stored.

**Playing Games:** Once logged in, choose from slot machines, blackjack, or roulette games available under your username's path (e.g., /username/slotMachine).

**Managing Credits:** Use Coinbase APIs to buy credits or withdraw your winnings securely. Monitor your credit balance and charge history directly within your account.

## Security ##
Crypto Casino prioritizes the security of its users:

* Passwords are hashed using bcrypt.
* Sessions are securely managed to prevent unauthorized access.
* Captchas protect against automated software interactions.
