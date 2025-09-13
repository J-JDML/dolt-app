// netlify/functions/validate-key.js
const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    // Permite apenas requisições POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Segredo JWT não configurado no servidor.' })
        };
    }

    try {
        // Pega a chave (token) enviada pelo frontend no corpo da requisição
        const { token } = JSON.parse(event.body);

        if (!token) {
            return {
                statusCode: 400,
                body: JSON.stringify({ valid: false, message: 'Nenhuma chave fornecida.' })
            };
        }

        // Tenta verificar a chave. Se a assinatura for inválida ou o token for malformado,
        // a função jwt.verify() lançará um erro, que será capturado pelo bloco catch.
        const decoded = jwt.verify(token, JWT_SECRET);

        // Se a verificação for bem-sucedida e o payload contiver premium: true
        if (decoded && decoded.premium === true) {
            return {
                statusCode: 200,
                body: JSON.stringify({ valid: true, message: 'Chave válida.' })
            };
        } else {
            // Caso o token seja válido mas não tenha o payload esperado
            return {
                statusCode: 400,
                body: JSON.stringify({ valid: false, message: 'Chave malformada.' })
            };
        }

    } catch (error) {
        // O erro mais comum aqui será JsonWebTokenError (assinatura inválida)
        console.error('Erro de validação:', error.name);
        return {
            statusCode: 401,
            body: JSON.stringify({ valid: false, message: 'Chave de ativação inválida.' })
        };
    }
};
