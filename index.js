const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
// Permite que seu site acesse a API
app.use(cors());
app.use(express.json());

// Pega a chave do Mercado Pago configurada no Render
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

app.post('/gerar-pagamento', async (req, res) => {
    try {
        const body = {
            items: [
                {
                    title: req.body.titulo,
                    quantity: 1,
                    unit_price: Number(req.body.valor),
                    currency_id: 'BRL',
                }
            ],
            back_urls: {
                success: "https://guuholiveira2202-png.github.io/Hype-PIzzaria/", 
                failure: "https://guuholiveira2202-png.github.io/Hype-PIzzaria/",
                pending: "https://guuholiveira2202-png.github.io/Hype-PIzzaria/",
            },
            auto_return: "approved",
            // Esta linha abaixo é a responsável por avisar o seu site qual pedido foi pago
            external_reference: req.body.idPedido 
        };

        const preference = new Preference(client);
        const result = await preference.create({ body });
        
        // Devolve o link de pagamento gerado pelo Mercado Pago
        res.json({ init_point: result.init_point });
    } catch (error) {
        console.error("Erro interno:", error);
        res.status(500).json({ error: "Erro ao gerar link de pagamento." });
    }
});

// A porta é definida pelo Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor HYPE STORE rodando na porta ${PORT}`);
});
