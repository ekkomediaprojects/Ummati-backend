const MembershipTier = require('../models/MembershipTier');

const defaultMembershipTiers = [
    {
        name: 'Free Member',
        price: 0,
        stripePriceId: null,
        stripeProductId: null,
        tierId: 'UCMT-F039B4',
        benefits: [
            'Access to public events',
            'Community newsletter',
            'Basic support'
        ],
        interval: 'month'
    },
    {
        name: 'Monthly Membership',
        price: process.env.MEMBERSHIP_PRICE,
        stripePriceId: process.env.STRIPE_PRICE_ID,
        stripeProductId: process.env.STRIPE_PRODUCT_ID,
        tierId: 'UCMT-M150DE',
        benefits: [
            'Access to all community events',
            'Monthly newsletter',
            'Member-only resources',
            'Priority support'
        ],
        interval: 'month'
    }
];

const initializeStripeMembershipTiers = async () => {
    try {
        for (const tier of defaultMembershipTiers) {
            const existingTier = await MembershipTier.findOne({ name: tier.name });
            
            if (!existingTier) {
                await MembershipTier.create(tier);
                console.log(`${tier.name} tier initialized successfully`);
            } else {
                // Update existing tier with any new values
                Object.assign(existingTier, tier);
                await existingTier.save();
                console.log(`${tier.name} tier updated successfully`);
            }
        }
    } catch (error) {
        console.error('Error initializing membership tiers:', error);
        throw error;
    }
};

const initializeStripeServices = async () => {
    try {
        await initializeStripeMembershipTiers();
        // Add other Stripe-related initialization here as needed
        console.log('Stripe services initialized successfully');
    } catch (error) {
        console.error('Stripe services initialization failed:', error);
        throw error;
    }
};

module.exports = {
    initializeStripeServices,
    initializeStripeMembershipTiers
}; 