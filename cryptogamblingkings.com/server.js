const coinbase = require('coinbase');
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const svgCaptcha = require('svg-captcha');
const path = require('path');

const app = express();

// --  /user/signIn
// --  /user/game
// --  /user/credits

// Middlewaree used to receive Coinbase Commerce notifications
// req.rawBody must be assigned BEFORE creating express.js middleware
app.use(bodyParser.json({
    verify: function(req, res, buf) {
        req.rawBody = buf.toString();
    }
}));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(session({
    secret: crypto.randomBytes(32).toString('hex'), 
    resave: false,
    saveUninitialized: true
}));

require('dotenv').config();

//Coinbase API Credentials
const COINBASE_API_KEY=process.env.COINBASE_API_KEY;
const COINBASE_API_SECRET=process.env.COINBASE_API_SECRET;

const Coinbase_Client = coinbase.Client;
const coinbaseClient = new Coinbase_Client({
    'apiKey': COINBASE_API_KEY,
    'apiSecret': COINBASE_API_SECRET,
    strictSSL: false //!!!!CHANGE IN PRODUCTION ENVIRONMENT!!!!\\
})

//Coinbase Commerce API Credentials
const COMMERCE_API_KEY = process.env.COMMERCE_API_KEY;
const COMMERCE_API_SECRET = process.env.COMMERCE_API_SECRET;

const headers = {
    'X-CC-Api-Key': COMMERCE_API_KEY,
    'X-CC-Version': '2018-03-22',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

// MongoDB connection and schema setup...
const MONGODB_USERNAME = process.env.MONGODB_USERNAME;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
const MONGODB_HOST = process.env.MONGODB_HOST;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

const encodedPassword = encodeURIComponent(MONGODB_PASSWORD);
const URI = `mongodb+srv://${MONGODB_USERNAME}:${encodedPassword}@${MONGODB_HOST}/${MONGODB_DB_NAME}`;

mongoose.connect(URI, {useNewUrlParser: true, useUnifiedTopology: true})
    .then(() => console.log("Connected to MongoDB...\n"))
    .catch(err => console.error("Failed to connect to MongoDB", err)); 

const userSchema = new mongoose.Schema({
    email: String,
    username: String, //email before @
    password: String,
    credits: Number,
    chargeHistory: [{
        checkoutId: String,
        amount: Number,
        chargeCode: String,
        status: String,
        timestamp: String
    }]
});

const User = mongoose.model('User', userSchema);


// Use Express's static middleware to serve files in the "games" directory
// app.use(express.static(path.join(__dirname, 'games')));

function requireLogin(req, res, next) {
    if (!req.session.email) {
        // If the user is not logged in, redirect to the homepage
        res.redirect('/');
    } else {
        // If the user is logged in, continue to the next middleware or route handler
        next();
    }
}


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/signIn', (req, res) => {
    res.sendFile(path.join(__dirname, 'signIn.html'));
})

app.post('/createUser', async (req, res) => {
    const { email, password } = req.body;
    
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).send('User already exists');
    }
    
    if(req.body.captcha === req.session.captcha) {
        const username = email.substring(0, email.indexOf("@"));
    
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
    
        var credits = 0;
        credits = credits.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        credits = Number(credits);
        
        // Create a new user with the hashed password
        const user = new User({ 
            email: email, 
            username: username, 
            password: hashedPassword, 
            credits: credits,
            chargeHistory: []
        });
    
        await user.save();
    
        console.log(`NEW USER: ${user.username}`)
    
        // Log the user in and redirect to the game
        req.session.email = user.email;
        return res.redirect(`/${user.username}`);
    } else {
        return res.status(400).send('Captcha verification failed');
    }
});


app.post('/signIn', async (req, res) => {
    const { email, password, captcha } = req.body;

    if(req.body.captcha === req.session.captcha) {
        // Find the user in the database
        const user = await User.findOne({ email });
    
        // If the user doesn't exist or the password is wrong, send back an error
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(400).send('Invalid email or password');
        }
    
        // If the login is successful, save the user's email in the session and redirect to the game
        req.session.email = user.email;
        // req.session.username = user.username;
    
        res.redirect(`/${user.username}`);
    } else {
        return res.status(400).send('Captcha verification failed');
    }
});



//CAPTCHA
app.get('/captcha', function (req, res) {
    var captcha = svgCaptcha.create();
    req.session.captcha = captcha.text;
    
    res.type('svg');
    res.status(200).send(captcha.data);
});
//CPATCHA



app.get('/:username', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.use('/:username/slotMachine', requireLogin, express.static(path.join(__dirname, 'games', 'slotMachine')));
app.use('/:username/roulette', requireLogin, express.static(path.join(__dirname, 'games', 'roulette')));

// app.get('/:game/user/:username', requireLogin, (req, res, next) => {
//     let game = req.params.game;
//     let username = req.params.username;

//     app.use(express.static(path.join(__dirname, 'games', game)));

//     // Continue to the next middleware function
//     next();
// });




// Sends client side the current user's info
app.get('/api/user', async (req, res) => {
    if (!req.session.email) {
        return res.status(401).send('User not logged in');
    }

    // Find the user in the database using the email stored in the session
    const user = await User.findOne({ email: req.session.email });

    // If the user doesn't exist, send back an error
    if (!user) {
        return res.status(404).send('User not found');
    }

    user.credits = user.credits.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    user.credits = Number(user.credits);

    // Send the user's data
    res.json({ email: user.email, credits: user.credits });
});


// API endpoint to subtract the bet amount from the user's credits
app.post('/api/bet', async (req, res) => {
    try {
        var { bet } = req.body;   
        
        // Find the user in the database
        const user = await User.findOne({ email: req.session.email });

        // If the user doesn't exist, send back an error
        if (!user) {
            return res.status(404).send('User not found');
        }
        
        console.log(`${user.username}: bet-${bet}`);

        bet = bet.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        bet = Number(bet);
        
        user.credits = user.credits.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        user.credits = Number(user.credits);

        // Subtract the bet from the user's credits
        user.credits -= bet;
        
        // Save the updated user
        await user.save();
        
        res.json({ credits: user.credits });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});



// API endpoint to add the win amount to the user's credits
app.post('/api/win', async (req, res) => {    
    var { win } = req.body;
    
    // Find the user in the database
    const user = await User.findOne({ email: req.session.email });

    if (!user) {
        return res.status(404).send('User not found');
    }

    console.log(`${user.username}: win-${win}`);

    win = win.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    win = Number(win);

    user.credits = user.credits.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    user.credits = Number(user.credits);
    
    // Add the win to the user's credits
    user.credits += win;
    
    // Save the updated user
    await user.save();
    
    res.json({ credits: user.credits });
});


app.get('/:username/credit-management', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'credit-management.html'));
});


app.post('/newCharge', async (req, res) => {
    const price = req.body.price;
    const email = req.session.email;

    const user = await User.findOne({ email: email });

    if (!user) {
        return res.status(404).send('User not found');
    }

    // Prepare the charge data
    let data = {
        name: `$${price}`,
        description: 'After the purchase, please go back and refresh the webpage. It may take up to 30 minutes to confirm the payment.',
        pricing_type: 'fixed_price',
        local_price: {
            amount: parseFloat(price),
            currency: 'USD'
        },
        metadata: {
            email: email
        },
        redirect_url: `http://localhost:3000/${user.username}/credit-management`,
        cancel_url: `http://localhost:3000/${user.username}/credit-management/`
    };

    // Create a charge via Coinbase Commerce API
    const response = await fetch('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    });

    const responseData = await response.json();
    if (response.ok){
        // Direct the client to the hosted charge page
        res.redirect(responseData.data.hosted_url);
    } else {
        // Log the error and send back the error response
        console.error(responseData);
        res.status(500).send(responseData);
    }
});


app.post('/commerce-notification', async (req, res) => {
    const signature = req.headers['x-cc-webhook-signature'];
    const hmac = crypto.createHmac('sha256', COMMERCE_API_SECRET);
    const hash = hmac.update(req.rawBody).digest('hex');

    if (signature !== hash) {
        console.log('❌ Invalid signature');
        res.status(400).send('Invalid signature');
        return;
    } else {
        console.log('✅ Coinbase: BUY');
    }

    const eventType = req.body.event.type;
    const chargeData = req.body.event.data;

    const userEmail = chargeData.metadata.email; // Assuming you're storing user email in metadata
    const checkoutId = chargeData.id;
    var amount = chargeData.pricing.local.amount; // Assuming you want the local amount
    const chargeCode = chargeData.code;
    const status = chargeData.timeline[chargeData.timeline.length - 1].status;
    const timestamp = chargeData.created_at;


    const user = await User.findOne({ email: userEmail });
    if (!user) {
        console.log('USER NOT FOUND');
        return res.status(404).send('User not found');
    }
    
    // Update condition to check if status is PENDING
    if (status === 'PENDING') {
        try {
            let chargeIndex = user.chargeHistory.findIndex(e => e.chargeCode === chargeCode);
            // If the charge code doesn't exist in charge history, add it
            if (chargeIndex === -1) {
                user.chargeHistory.push({
                    checkoutId: checkoutId,
                    amount: amount,
                    chargeCode: chargeCode,
                    status: status,
                    timestamp: timestamp
                });
            } 
            // If the charge code already exists, update status, timestamp, and amount
            else {
                user.chargeHistory[chargeIndex].status = status;
                user.chargeHistory[chargeIndex].timestamp = timestamp;
            }
            await user.save();
            console.log(`${chargeCode} STATUS: PENDING`);
        } catch (err) {
            console.log('Error finding or updating user:', err);
        }
    }


    if (status === 'COMPLETED') {
        try {
            let chargeIndex = user.chargeHistory.findIndex(e => e.chargeCode === chargeCode);
            user.chargeHistory[chargeIndex].status = status;
            user.chargeHistory[chargeIndex].timestamp = timestamp;

            amount = amount.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
            amount = Number(amount);

            user.credits = user.credits.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
            user.credits = Number(user.credits);

            // Update credits
            user.credits += amount;

            await user.save();
            console.log(`${chargeCode} STATUS: COMPLETED`);
            
            //Redirect to login page
            return res.redirect(`/${user.username}/credit-managment`);
        } catch(err) {
            console.log('Error finding or updating user:', err);
        }
    }

    res.status(200).send('OK');
});


// Coinbase BTC - 98bdbfe3-aea1-5495-b4eb-d660c3fcc288
// Exodus BTC - bc1qezr90e39kdv2sdeehmducrqgqfr0m8w9cyna2q
app.post('/withdraw', async (req, res) => {
    const wallet_address = req.body.wallet_address;
    var withdraw_amount = req.body.withdraw_amount;
    const currency = req.body.currency;

    const user = await User.findOne({ email: req.session.email });

    withdraw_amount = withdraw_amount.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    withdraw_amount = Number(withdraw_amount);

    if (withdraw_amount < 10.00) {
        return res.status(400).send('Withdraw amount must be more than $10');
    } else if (user.credits < withdraw_amount) {
        return res.status(400).send('Not enough credits for withdrawal');
    }

    const exchangeRate = await fetch(`https://api.coinbase.com/v2/exchange-rates?currency=${currency}`);
    const exchangeRateData = await exchangeRate.json();

    // Get the USD to Selected Crypto exchange rate
    const usdToCryptoRate = exchangeRateData.data.rates.USD;

    var cryptoAmount = withdraw_amount / usdToCryptoRate;
    cryptoAmount = Number(cryptoAmount.toFixed(8));  // limit to 8 decimal places


    const accountID = '98bdbfe3-aea1-5495-b4eb-d660c3fcc288' //BTC
    
    try {
        const { v4: uuidv4 } = require('uuid');
        let idem = uuidv4();

        await coinbaseClient.getAccount(accountID, async function(err, account) {
            if (err) {
                console.error('Error getting account:', err);
                return;
            }
            
            await account.sendMoney({
                'to': wallet_address,
                'amount': cryptoAmount,
                'currency': currency,
                'idem': idem
            }, async function(err, tx) {
                if (err) {
                    console.error('Error sending money:', err);
                }

                user.credits -= withdraw_amount;
                await user.save();

                console.log(tx);
                console.log(`CRYPTO SENT \n TO: ${wallet_address} \n AMOUNT: ${withdraw_amount}`)
                res.redirect(`/${user.username}/credit-management`)
            });
        });
        
    } catch (error) {
        console.error('An unexpected error occurred:', error);
    }    
})

app.post('/send-money', (req, res) => {
    // Coinbase sends the raw request body string in the req.rawBody property
    const signature = req.headers['x-cc-webhook-signature'];
    const hmac = crypto.createHmac('sha256', COINBASE_API_SECRET);
    const hash = hmac.update(req.rawBody).digest('hex');

    if (signature !== hash) {
        console.log('Invalid signature');
        res.status(400).send('Invalid signature');
        return;
    }

    console.log('✅ Coinbase: WITHDRAW');

    const eventType = req.body.event.type;
    if (eventType === 'charge:confirmed') {
        // Payment has been confirmed
        // Update your database or perform other actions
        console.log("SENT MONEY: CONFIRMED");
    } else if (eventType === 'charge:pending') {
        // Payment is pending
        // You might want to inform the user or take other action
        console.log("SENT MONEY: PENDING");
    }

    // Always respond to the webhook with a 200 status code
    // to acknowledge receipt of the notification
    res.redirect(`/${user.username}/credit-management`)
});
  

app.delete('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
        if (err) {
            res.status(400).send('Unable to log out')
        } else {
            res.send('Logout successful')
        }
        });
    } else {
        res.end()
    }
})


app.listen(3000, () => console.log('Server running on port 3000'));