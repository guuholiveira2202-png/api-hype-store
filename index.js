const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

// Configurações Globais
app.use(cors());
app.use(express.json());

// Instância do Mercado Pago utilizando a variável de ambiente
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});

// URL do Front-end no GitHub Pages
const SITE_URL = "https://guuholiveira2202-png.github.io/Hype-PIzzaria/";

// =======================================================
// ROTA 1: Status do Servidor (Para verificar se está online)
// =======================================================
app.get('/', (req, res) => {
    res.send('🚀 Servidor HYPE STORE rodando com sucesso!');
});

// =======================================================
// ROTA 2: Gerar Pagamento (Mercado Pago)
// =======================================================
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
        
        // Retorna o link do checkout para o front-end
        res.json({ init_point: result.init_point });
    } catch (error) {
        console.error("Erro interno no Mercado Pago:", error);
        res.status(500).json({ error: "Erro ao gerar link de pagamento." });
    }
});

// =======================================================
// ROTA 3: Enviar Pedido para o SuperFrete
// =======================================================
app.post('/enviar-superfrete', async (req, res) => {
    try {
        const { pedido } = req.body;

        if (!pedido) {
            return res.status(400).json({ error: "Dados do pedido não foram enviados." });
        }

        const SUPERFRETE_TOKEN = process.env.SUPERFRETE_TOKEN;
        if (!SUPERFRETE_TOKEN) {
            return res.status(500).json({ error: "SUPERFRETE_TOKEN não configurado no servidor." });
        }

        // Remetente (Sua Loja)
        const REMETENTE = {
            name: "Hype Store",
            phone: "11999999999",
            email: "contato@hypestore.com",
            document: "00000000000",
            company_name: "Hype Store",
            postal_code: "01001000",
            address: "Praça da Sé",
            number: "100",
            district: "Centro",
            city: "São Paulo",
            state_code: "SP"
        };

        // Tratamento do CEP de destino
        const cepLimpo = (pedido.shipping?.cep || "").replace(/\D/g, '');
        if (!cepLimpo || cepLimpo.length !== 8) {
            return res.status(400).json({ error: `CEP inválido para o pedido ${pedido.id || ''}` });
        }

        // Monta o payload no padrão do SuperFrete
        const payloadSuperFrete = {
            from: REMETENTE,
            to: {
                name: pedido.cliente?.nome || "Cliente Hype",
                phone: (pedido.cliente?.whatsapp || "11999999999").replace(/\D/g, ''),
                email: pedido.cliente?.email || "cliente@email.com",
                document: (pedido.cliente?.cpf || "00000000000").replace(/\D/g, ''),
                postal_code: cepLimpo,
                address: pedido.shipping?.logradouro || "Rua Principal",
                number: pedido.shipping?.numero || "10",
                district: pedido.shipping?.bairro || "Bairro",
                city: (pedido.shipping?.cidadeUF || "Sao Paulo/SP").split('/')[0].trim(),
                state_code: (pedido.shipping?.cidadeUF || "SP").split('/')[1]?.trim() || "SP",
                note: `Pedido ${pedido.id ? '#' + pedido.id.substring(0, 8).toUpperCase() : ''}`
            },
            products: pedido.items?.map(item => ({
                name: item.name || "Produto Hype",
                quantity: item.quantity || 1,
                unitary_value: item.price || 10
            })) || [],
            volumes: [{ height: 10, width: 15, length: 20, weight: 0.5 }],
            options: {
                insurance_value: pedido.totals?.finalTotal || 0,
                receipt: false,
                own_hand: false,
                reverse: false,
                non_commercial: true
            },
            service: 1
        };

        // Dispara para a API oficial do SuperFrete (Sem problemas de CORS)
        const response = await axios.post('https://api.superfrete.com/api/v2/cart', payloadSuperFrete, {
            headers: {
                'Authorization': `Bearer ${SUPERFRETE_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        return res.json({ success: true, data: response.data });
    } catch (error) {
        console.error("Erro no SuperFrete:", error.response?.data || error.message);
        return res.status(500).json({ 
            error: "Erro ao enviar pedido ao SuperFrete.", 
            detalhes: error.response?.data || error.message 
        });
    }
});

// =======================================================
// INICIALIZAÇÃO DO SERVIDOR
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor HYPE STORE rodando com sucesso na porta ${PORT}`);
});