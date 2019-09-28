'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError, ArgumentsRequired, InvalidOrder } = require('./base/errors');

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
                'cancelOrders': true,
                'fetchBalance': true,
                'fetchOrder': true,
                'fetchOrders': true,
                'fetchOrderBook': true,
                'fetchOHLCV': true,
                'fetchMarkets': true,
                'fetchTicker': true,
                'fetchTrades': true
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
                    'public': 'https://api.cointradecx.com/apiv2',
                    'broker': 'https://broker.cointradecx.com/apiv2',
                    'private': 'https://api.cointradecx.com/apiv2'
                },
                'www': 'https://broker.cointradecx.com',
                'doc': [
                    'https://docs.cointradecx.com/?version=latest',
                ],
            },
            'api': {
                'broker': {
                    'get': [
                        'udfchart/history'
                    ],
                },
                'public': {
                    'get': [
                        'ordens/{pair}', // order book by pair
                        'ticket/markets', // get market list
                        'ticket/market/{pair}', // fetch ticker by pair
                        'trades/{pair}' // last negotiations by pair
                    ],
                },
                'private': {
                    'get': [
                        'book', // open orders 
                        'book/{pair}', // open orders by pair
                        'book/{id}', // get order by id
                        'account/balance'
                    ],
                    'delete': [
                        'book/all', // delete all orders
                        'book/{id}' // delete order by id                      
                    ],
                    'post': [
                        'book/buy',
                        'book/sell',
                    ],
                }
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
        const data = await this.publicGetTicketMarkets();
        const result = [];
        for (let i = 0; i < data.markets.length; i++) {
            const market = data.markets[i];
            let id = market.toUpperCase();
            const parts = id.split(':');
            let baseId = parts[0];
            let quoteId = parts[1];
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
            'pair': market.id,
        };
        const response = await this.publicGetOrdensPair(this.extend(request, params));
        return this.parseOrderBook(response, undefined, 'compra', 'venda', "preco", "volume");
    }

    async fetchTicker(symbol, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'pair': market['base'],
        };

        const response = await this.publicGetTicketMarketPair(this.extend(request, params));
        const ticker = this.safeValue(response, 'market', {});
        const timestamp = this.milliseconds();
        const last = this.safeFloat(ticker, 'lastPrice');
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'high': this.safeFloat(ticker, 'highPrice'),
            'low': this.safeFloat(ticker, 'lowPrice'),
            'bid': this.safeFloat(ticker, 'buyPrice'),
            'bidVolume': undefined,
            'ask': this.safeFloat(ticker, 'sellPrice'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': this.safeFloat(ticker, 'volumeCurrency'),
            'quoteVolume': this.safeFloat(ticker, 'volume'),
            'info': ticker,
        };
    }

    parseTrade(trade, market = undefined) {
        const timestamp = this.safeTimestamp(trade, 'date');
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const id = this.safeString(trade, 'tid');
        const type = undefined;
        const side = this.safeString(trade, 'type');
        const price = this.safeFloat(trade, 'price');
        const amount = this.safeFloat(trade, 'amount');
        let cost = undefined;
        if (price !== undefined) {
            if (amount !== undefined) {
                cost = price * amount;
            }
        }
        return {
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'symbol': symbol,
            'order': undefined,
            'type': type,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        };
    }

    async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        let method = 'publicGetCoinTrades';
        const request = {
            'coin': market['base'],
        };
        if (since !== undefined) {
            method += 'From';
            request['from'] = parseInt(since / 1000);
        }
        const to = this.safeInteger(params, 'to');
        if (to !== undefined) {
            method += 'To';
        }
        const response = await this[method](this.extend(request, params));
        return this.parseTrades(response, market, since, limit);
    }

    async fetchBalance(params = {}) {
        await this.loadMarkets();
        const response = await this.privateGetAccountBalance(params);
        const result = { 'info': response };
        let currencies = Object.keys(this.currencies);

        for (let i = 0; i < currencies.length; i++) {
            const code = currencies[i];
            const account = this.account();
            account['free'] = this.safeFloat(response, code + '_available');
            account['used'] = this.safeFloat(response, code + '_locked');
            account['total'] = this.safeFloat(response, code);
            result[code] = account;
        }
        return this.parseBalance(result);
    }

    async createOrder(symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets();
        let method = 'privatePostBook' + this.capitalize(side);
        const request = { 'market': this.marketId(symbol) };

        if (price > 0) {
            request['price'] = this.priceToPrecision(symbol, price);
        }

        request['amount'] = this.amountToPrecision(symbol, amount);
        request['limited'] = type === 'limit';
        let timestamp = this.milliseconds();

        const response = await this[method](this.extend(request, params));
        // TODO: replace this with a call to parseOrder for unification
        return {
            'info': response,
            'id': response["order_id"],
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'type': type,
            'side': side,
            'amount': amount,
            'price': price
        };
    }

    async cancelOrder(id, symbol = undefined, params = {}) {
        await this.loadMarkets();
        const request = {
            'id': id,
        };
        const response = await this.privateDeleteBookId(this.extend(request, params));        
        return response.sucesso;
    }

    async cancelAllOrders() {
        const response = await this.privateDeleteBookAll();
        return response.sucesso;
    }

    parseOrderStatus(status) {
        const statuses = {
            'EMPTY': 'open',
            'CANCELED': 'canceled',
            'CLOSED': 'closed'
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
                if (negotiations[index].price) {
                    average + negotiations[index].price;
                }
            }
            average = average / negotiations.length;
        }

        const amount = this.safeFloat(order, 'amount');
        const filled = this.safeFloat(order, 'exec_amount');
        const remaining = amount - filled;
        const cost = filled * average;
        return {
            'info': order,
            'id': id,
            'timestamp': undefined,
            'datetime': undefined,
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': this.safeValue(order, 'limited') ? 'limit' : 'market',
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
        const market = this.market(symbol);
        const request = {
            'id': id,
        };
        const response = await this.privateGetBookId(this.extend(request, params));
        const order = this.safeValue(response, 'order');
        return this.parseOrder(order, market);
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
            'symbol': market['id'],
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

        let ohlcv = [];

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

    async fetchOrders(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        let method = "privateGetBook";
        let market = undefined;

        let request = {};
        if (symbol !== undefined) {
            market = this.market(symbol);
            method = "privateGetBookPair";
            request = {
                'pair': market.id,
            };
        }

        const response = await this[method](this.extend(request, params));
        const orders = this.safeValue(response, 'orders', []);
        return this.parseOrders(orders, market, since, limit);
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = {}, body = undefined) {
        let url = this.urls['api'][api] + '/';
        url += this.implodeParams(path, params);
        headers['Content-Type'] = "application/json";

        if (api === "public" || api == 'broker') {
            const query = this.omit(params, this.extractParams(path));
            if (Object.keys(query).length) {
                url += '?' + this.urlencode(query);
            }
        }
        else {
            this.checkRequiredCredentials();
            let token = this.stringToBase64(this.secret + ':' + this.apiKey);
            headers = {
                'Content-Type': 'application/json; charset=UTF-8',
                'Authorization': 'Basic ' + token
            };
        }

        if (method === "POST" || method === "PUT" || method === "DELETE") {
            body = this.json(params);
        }

        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    async request(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const response = await this.fetch2(path, api, method, params, headers, body);
        if (!response.sucesso) {
            throw new ExchangeError(this.id + ' ' + response.mensagem);
        }
        return response;
    }
};
