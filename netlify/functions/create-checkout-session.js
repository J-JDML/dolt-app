// netlify/functions/create-checkout-session.js

// Importa a biblioteca do Stripe e a inicializa com sua chave secreta
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// O handler é a função principal que o Netlify vai executar
exports.handler = async (event) => {
    // ID do Preço do seu produto no Stripe (aquele que criamos, mensal)
    // Você pode encontrar isso no painel do Stripe, na página do seu produto.
    const priceId = 'price_1S4uUqF9fcdEycIMHEkyxhnE'; // SUBSTITUA AQUI

    // LÓGICA DE AUTENTICAÇÃO: Aqui, você precisará obter o ID do usuário
    // que está logado no Supabase. Por enquanto, usaremos um placeholder.
    // Quando o frontend tiver o login, ele enviará o ID do usuário para esta função.
    const userId = 'c418c5ed-64d8-476a-bf9b-b3cd1d94508e'; // SUBSTITUA AQUI

    try {
        // Cria a sessão de Checkout no Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            // Anexamos o ID do nosso usuário do Supabase aqui.
            // É assim que saberemos quem pagou quando o webhook nos notificar.
            client_reference_id: userId,
            
            // URLs para onde o usuário será enviado após a ação
            // process.env.URL é uma variável que o Netlify fornece com a URL base do seu site
            success_url: `${process.env.URL || 'http://localhost:8888'}/success.html`,
            cancel_url: `${process.env.URL || 'http://localhost:8888'}/cancel.html`,
        });

        // Retorna a URL da sessão de checkout para o frontend
        return {
            statusCode: 200,
            body: JSON.stringify({ url: session.url }),
        };
    } catch (error) {
        console.error('Erro ao criar sessão de checkout:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Falha ao criar sessão de pagamento.' }),
        };
    }
};
