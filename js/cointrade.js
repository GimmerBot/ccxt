'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError } = require('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class cointrade extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'cointrade',
            'name': 'Cointrade',
            'countries': ['BR'], // Brazil
            'rateLimit': 200,
            'version': 'v2',
            'has': {
                'CORS': true,
                'createMarketOrder': true,
                'createOrder': true,
                'cancelOrder': true,
                'cancelOrders': false,
                'fetchBalance': true,
                'fetchOrder': true,
                'fetchOrders': true,
                'fetchOrderBook': true,
                'fetchOHLCV': true,
                'fetchMarkets': true,
                'fetchTicker': true,
                'fetchTrades': false
            },
            'timeframes': {
                '5m': '5',
                '15m': '15',
                '30m': '30',
                '1h': '60',
                '6h': '360',
                '12h': '720',
                '1d': '1D',
                '7d': '7D',
                '1w': '1M',
                '3w': '3M',
            },
            'urls': {
                'logo': 'https://broker.cointradecx.com/resources/images/logo-cointrade1.png',
                'api': {
                    'public': 'https://api.cointradecx.com/public',
                    'broker': 'https://broker.cointradecx.com/apiv2',
                    'private': 'https://api.cointradecx.com/private',
                },
                'www': 'https://broker.cointradecx.com',
                'doc': [
                    'https://docs.cointradecx.com/?version=latest',
                ],
            },
            'api': {
                'broker': {
                    'get': [
                        'udfchart/history',
                    ],
                },
                'public': {
                    'get': [
                        'orderbook', // order book by pair
                        'markets', // get market list
                        'ticker?market={pair}', // fetch ticker by pair
                        'trades/{pair}', // last negotiations by pair
                    ],
                },
                'private': {
                    'get': [
                        'book', // open orders
                        'book/{pair}', // open orders by pair
                        'myorders?market={symbol}&idOrder={id}&type=ALL', // get order by id
                        'balance?asset={asset}',
                    ],
                    'delete': [
                        'cancelallorders', // delete all orders
                        'book/{id}', // delete order by id
                    ],
                    'post': [
                        'buy',
                        'sell'
                    ],
                },
            },
            'fees': {
                'trading': {
                    'maker': 0.25 / 100,
                    'taker': 0.25 / 100,
                },
            },
        });
    }

    async fetchMarkets(params = {}) {
        const data = await this.publicGetMarkets(params);
        const result = [];
        for (let i = 0; i < data.result.length; i++) {
            const market = data.result[i];
            const id = market.marketName;
            const parts = market.marketName.split('_');
            const baseId = parts[0];
            const quoteId = parts[1];
            const base = this.safeCurrencyCode(baseId);
            const quote = this.safeCurrencyCode(quoteId);
            const symbol = base + '/' + quote;
            const precision = {
            };
            const limits = {};
            limits['cost'] = {};
            result.push({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': true,
                'precision': precision,
                'limits': limits,
                'info': market,
            });
        }
        return result;
    }

    async fetchOrderBook(symbol, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'market': market.id,
            'type': 'ALL',
            'depth': 1000
        };
        const response = await this.publicGetOrderbook(this.extend(request, params));
        return this.parseOrderBook(response.result, 'timestamp', 'buy', 'sell', 'price', 'quantity');
    }

    async fetchTicker(symbol, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'pair': market.id
        };
        const response = await this.publicGetTickerMarketPair(this.extend(request, params));
        const ticker = response.result[0];
        const timestamp = this.safeValue(ticker, 'timestamp');
        const last = this.safeFloat(ticker, 'last');
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'high': this.safeFloat(ticker, 'high24h'),
            'low': this.safeFloat(ticker, 'low24h'),
            'bid': this.safeFloat(ticker, 'bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat(ticker, 'ask'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': this.safeFloat(ticker, 'vol24h'),
            'quoteVolume': this.safeFloat(ticker, 'quoteVolume'),
            'info': ticker,
        };
    }

    parseTrade(trade, market = undefined) {
        const date = this.safeValue(trade, 'data');
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const type = undefined;
        const side = this.safeString(trade, 'tipo');
        const price = this.safeFloat(trade, 'preco');
        const amount = this.safeFloat(trade, 'volume');
        let cost = undefined;
        if (price !== undefined) {
            if (amount !== undefined) {
                cost = price * amount;
            }
        }
        return {
            'info': trade,
            'timestamp': undefined,
            'datetime': date,
            'symbol': symbol,
            'order': undefined,
            'type': type,
            'side': side === 'Compra' ? 'buy' : 'sell',
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': cost * this.fees.trading.maker,
        };
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'pair': market.id,
        };
        const response = await this.publicGetTradesPair(this.extend(request, params));
        const trades = this.safeValue(response, 'trades');
        return this.parseTrades(trades, market, since, limit);
    }

    async fetchBalance(params = {}) {
        await this.loadMarkets();
        let request = {
            "asset": ""
        }
        const response = await this.privateGetBalanceAssetAsset(this.extend(request, params));
        let result = {};
        for (let i = 0; i < response.result.length; i++) {
            const wallet = response.result[i];
            const account = this.account();
            account['free'] = parseFloat(wallet.balanceAvailable);
            account['used'] = parseFloat(wallet.balanceTotal) - parseFloat(wallet.balanceAvailable);
            account['total'] = parseFloat(wallet.balanceTotal);
            result[wallet.asset.toUpperCase()] = account;
        }
        return this.parseBalance(result);
    }

    async createOrder(symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets();
        const method = 'privatePost' + this.capitalize(side);
        const request = { 'market': this.marketId(symbol) };
        if (price > 0) {
            request['price'] = this.priceToPrecision(symbol, price);
        }
        request['amount'] = this.amountToPrecision(symbol, amount);
        request['limited'] = type === 'limit';
        const timestamp = this.milliseconds();
        const response = await this[method](this.extend(request, params));
        // TODO: replace this with a call to parseOrder for unification
        return this.parseOrder(response.result);
    }

    async cancelOrder(id, symbol = undefined, params = {}) {
        await this.loadMarkets();
        const request = {
            'id': id,
        };
        const response = await this.privateDeleteBookId(this.extend(request, params));
        return response.sucesso;
    }

    async cancelAllOrders(symbol = undefined, params = {}) {
        await this.loadMarkets();
        let market = this.market(symbol);
        let request = {
            type: "ALL",
            market: market.id
        }

        const response = await this.privateDeleteCancelallorders(this.extend(request, params));
        return response.sucesso;
    }

    parseOrderStatus(status) {
        const statuses = {
            'EMPTY': 'open',
            'CANCELED': 'canceled',
            'CLOSED': 'closed',
            'FILLED': 'closed'
        };
        return this.safeString(statuses, status, status);
    }

    parseOrder(order, market = undefined) {
        const id = this.safeString(order, 'id');
        let side = undefined;
        if ('type' in order) {
            side = (order['type'] === 'BUY') ? 'buy' : 'sell';
        }
        const status = this.parseOrderStatus(this.safeString(order, 'status'));
        let symbol = undefined;
        if (order.market !== undefined) {
            const marketId = this.safeString(order, 'market');
            market = this.safeValue(this.markets_by_id, marketId);
        }
        if (market !== undefined) {
            symbol = market.symbol;
        }
        const fee = {
            'cost': this.safeFloat(order, 'cost'),
            'currency': market['quote'],
        };
        const price = this.safeFloat(order, 'price');
        const negotiations = this.safeValue(order, 'negociacoes', []);
        let average = 0;
        if (negotiations.length) {
            for (let index = 0; index < negotiations.length; index++) {
                const price = this.safeFloat(negotiations[index], 'price', 0);
                if (price > 0) {
                    average = average + price;
                }
            }
            average = average / negotiations.length;
        }
        const amount = this.safeFloat(order, 'amount');
        const filled = this.safeFloat(order, 'amountBaseTraded');
        const remaining = amount - filled;
        const cost = filled * average;
        const limited = JSON.parse(this.safeValue(order, 'limited'));
        return {
            'info': order,
            'id': id,
            'timestamp': order.timestamp,
            'datetime': this.iso8601(order.timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': limited ? 'limit' : 'market',
            'side': side,
            'price': price,
            'cost': cost,
            'average': average,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'status': status,
            'fee': fee,
            'trades': undefined, // todo parse trades (operations)
        };
    }

    async fetchOrder(id, symbol = undefined, params = {}) {
        await this.loadMarkets();

        const request = {
            'id': id
        };
        const market = this.market(symbol);

        if (symbol) {
            request['symbol'] = market.id;
        }

        const response = await this.privateGetMyordersMarketSymbolIdOrderIdTypeALL(this.extend(request, params));
        const order = this.safeValue(response.result, 'order');
        return this.parseOrder(order[0], market);
    }

    parseOHLCV(ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        return [
            this.safeTimestamp(ohlcv, 'timestamp'),
            this.safeFloat(ohlcv, 'open'),
            this.safeFloat(ohlcv, 'high'),
            this.safeFloat(ohlcv, 'low'),
            this.safeFloat(ohlcv, 'close'),
            this.safeFloat(ohlcv, 'volume'),
        ];
    }

    async fetchOHLCV(symbol, timeframe = '5m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'resolution': this.timeframes[timeframe],
            'symbol': market['id'].replace("_", ":"),
        };
        if (limit !== undefined && since !== undefined) {
            request['from'] = parseInt(since / 1000);
            request['to'] = this.sum(request['from'], limit * this.parseTimeframe(timeframe));
        } else if (since !== undefined) {
            request['from'] = parseInt(since / 1000);
            request['to'] = this.sum(this.seconds(), 1);
        } else if (limit !== undefined) {
            request['to'] = this.seconds();
            request['from'] = request['to'] - (limit * this.parseTimeframe(timeframe));
        }
        const response = await this.brokerGetUdfchartHistory(this.extend(request, params));
        const ohlcv = [];
        for (let i = 0; i < response.t.length; i++) {
            ohlcv.push({
                'timestamp': response.t[i],
                'open': response.o[i],
                'high': response.h[i],
                'low': response.l[i],
                'close': response.c[i],
                'volume': response.v[i],
            });
        }
        return this.parseOHLCVs(ohlcv, market, timeframe, since, limit);
    }

    async fetchOrders(symbol, params = {}) {
        await this.loadMarkets();

        const request = {     
            'id': "ALL"       
        };
        const market = this.market(symbol);

        if (symbol) {
            request['symbol'] = market.id;
        }

        const response = await this.privateGetMyordersMarketSymbolIdOrderIdTypeALL(this.extend(request, params));
        const orders = this.safeValue(response.result, 'orders');
        return this.parseOrders(orders, market);
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/';
        url += this.implodeParams(path, params);
        if (!headers) {
            headers = {};
        }
        headers['Content-Type'] = 'application/json';
        if (api === 'public' || api === 'broker') {
            const query = this.omit(params, this.extractParams(path));
            if (Object.keys(query).length) {
                url += '?' + this.urlencode(query);
            }
        } else {
            this.checkRequiredCredentials();
            const token = this.stringToBase64(this.secret + ':' + this.apiKey);
            headers['Authorization'] = 'Basic ' + token;
        }
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
            body = this.json(params);
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    async request(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const response = await this.fetch2(path, api, method, params, headers, body);
        if (response.success || response.sucesso) {
            return response;
        }        
        throw new ExchangeError(this.id + ' ' + response.mensagem);
    }
};
