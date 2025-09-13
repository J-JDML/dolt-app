// netlify/functions/generate-key.js
const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    // Pega o segredo das variáveis de ambiente do Netlify
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Segredo JWT não configurado no servidor.' })
        };
    }

    try {
        // Carga útil (payload) do nosso token. Simples e direto.
        const payload = {
            premium: true,
            generatedAt: Date.now()
        };

        // Assina o token com o segredo. Não definimos expiração para um passe vitalício.
        const token = jwt.sign(payload, JWT_SECRET);

        // Retorna a chave de ativação gerada
        return {
            statusCode: 200,
            body: JSON.stringify({ activationKey: token })
        };

    } catch (error) {
        console.error('Erro ao gerar a chave:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Não foi possível gerar a chave de ativação.' })
        };
    }
};
