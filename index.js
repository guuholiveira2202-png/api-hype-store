// 1. Carrega as variáveis de ambiente (Tokens) do arquivo .env
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

// =======================================================
// CONFIGURAÇÕES GLOBAIS
// =======================================================
app.use(cors());
app.use(express.json());

// Instância do Mercado Pago utilizando a variável de ambiente
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});

// URL do Front-end no GitHub Pages (Para onde o Mercado Pago deve redirecionar)
const SITE_URL = "https://guuholiveira2202-png.github.io/Hype-PIzzaria/";

// =======================================================
// ROTA 1: Status do Servidor (Health Check)
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
            // Envia o ID do Firebase/Pedido para o Mercado Pago
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

        // =======================================================
        // ⚠️ PREENCHA COM SEUS DADOS REAIS DE REMETENTE
        // =======================================================
        const REMETENTE = {
            name: "Hype Store",
            phone: "11999999999", // Seu WhatsApp/Telefone real
            email: "contato@hypestore.com",
            document: "SEU_CPF_OU_CNPJ_AQUI", // ⚠️ OBRIGATÓRIO: Apenas números
            company_name: "Hype Store",
            postal_code: "01001000", // Seu CEP real
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

        // Tratamento do CPF de destino (Obrigatório para o SuperFrete)
        const docCliente = (pedido.cliente?.cpf || "").replace(/\D/g, '');
        if (!docCliente) {
            return res.status(400).json({ error: "CPF do cliente é obrigatório para gerar frete." });
        }

        // Regra de Seguro dos Correios: Mínimo de R$ 25,00
        let valorFinal = Number(pedido.totals?.finalTotal) || 0;
        let valorSeguro = (valorFinal > 0 && valorFinal < 25) ? 25 : valorFinal;

        // Monta o payload no padrão da V2 do SuperFrete
        const payloadSuperFrete = {
            from: REMETENTE,
            to: {
                name: pedido.cliente?.nome || "Cliente Hype",
                phone: (pedido.cliente?.whatsapp || "11999999999").replace(/\D/g, ''),
                email: pedido.cliente?.email || "cliente@email.com",
                document: docCliente, 
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
                insurance_value: valorSeguro,
                receipt: false,
                own_hand: false,
                reverse: false,
                non_commercial: true // true = envio com declaração de conteúdo (sem NFe)
            },
            service: 1 // 1 = PAC, 2 = SEDEX
        };

        // Dispara para a API oficial do SuperFrete
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