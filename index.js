const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

// Permite que o seu site acesse a API
app.use(cors());
app.use(express.json());

// Pega a chave do Mercado Pago configurada nas variáveis de ambiente do Render
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});

// URL do seu site hospedado no GitHub Pages
const SITE_URL = "https://guuholiveira2202-png.github.io/Hype-PIzzaria/";

app.post('/gerar-pagamento', async (req, res) => {
    try {
        const { titulo, valor, email, idPedido } = req.body;

        const body = {
            items: [
                {
                    title: titulo || "Pedido Hype Store",
                    quantity: 1,
                    unit_price: Number(valor),
                    currency_id: 'BRL',
                }
            ],
            payer: {
                email: email
            },
            // VÍNCULO FUNDAMENTAL: Envia o ID do Firebase para o Mercado Pago
            external_reference: idPedido, 
            back_urls: {
                success: SITE_URL,
                failure: SITE_URL,
                pending: SITE_URL,
            },
            // Redireciona o cliente automaticamente para o site após aprovação
            auto_return: "approved",
        };

        const preference = new Preference(client);
        const result = await preference.create({ body });
        
        // Retorna o link de pagamento para o front-end
        res.json({ init_point: result.init_point });
    } catch (error) {
        console.error("Erro interno no Mercado Pago:", error);
        res.status(500).json({ error: "Erro ao gerar link de pagamento." });
    }
});

// A porta é definida dinamicamente pelo Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor HYPE STORE rodando na porta ${PORT}`);
});