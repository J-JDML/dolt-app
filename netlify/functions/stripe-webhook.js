// netlify/functions/stripe-webhook.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Inicializa o cliente do Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async ({ body, headers }) => {
    try {
        // 1. Verifica se a requisição veio mesmo do Stripe, usando o segredo do webhook
        const event = stripe.webhooks.constructEvent(body, headers['stripe-signature'], webhookSecret);

        // 2. Se a verificação for bem-sucedida, lida com o evento
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                const userId = session.client_reference_id;
                const customerId = session.customer;
                const subscriptionId = session.subscription;

                // 3. Atualiza o perfil do usuário no Supabase
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        stripe_customer_id: customerId,
                        subscription_id: subscriptionId, 
                        subscription_status: 'active'
                    })
                    .eq('id', userId);

                if (error) {
                    console.error('Erro ao atualizar usuário no Supabase:', error);
                    // Retorna um erro para que o Stripe tente reenviar o webhook
                    return { statusCode: 500, body: JSON.stringify({ error: 'DB update failed' }) };
                }
                console.log(`Assinatura ativada para o usuário: ${userId}`);
                break;

            case 'customer.subscription.deleted':
                // Este evento ocorre quando a assinatura é cancelada
                const subscription = event.data.object;
                const { error: deleteError } = await supabase
                    .from('profiles')
                    .update({ subscription_status: 'canceled' })
                    .eq('subscription_id', subscription.id);
                
                if (deleteError) {
                    console.error('Erro ao cancelar assinatura no Supabase:', deleteError);
                    return { statusCode: 500, body: JSON.stringify({ error: 'DB update failed' }) };
                }
                console.log(`Assinatura cancelada para a subscription_id: ${subscription.id}`);
                break;
            
            // Adicione outros eventos que queira ouvir, como 'customer.subscription.updated'
        }

        // 4. Retorna uma resposta de sucesso para o Stripe
        return { statusCode: 200 };

    } catch (err) {
        console.log(`⚠️ Erro no webhook: ${err.message}`);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }
};
