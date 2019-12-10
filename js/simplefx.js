'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const request = require("request");
const { ExchangeError, ArgumentsRequired, InvalidOrder } = require('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class simplefx extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'simplefx',
            'name': 'Simplefx',
            'rateLimit': 1000,
            'version': 'v3',
            'has': {
                'CORS': true,
                'createMarketOrder': true,
                'fetchOrder': true,
                'withdraw': true,
                'fetchOHLCV': true,
                'fetchMarkets': true,
                'fetchOrders': true,
                'fetchOpenOrders': true,
                'fetchTicker': true,
                'fetchTickers': false,
            },
            'timeframes': {
                '1m': 60,
                '5m': 300,
                '15m': 900,
                '30m': 1800,
                '1h': 3600,
                '4h': 14400,
                '1d': 86400
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/27837060-e7c58714-60ea-11e7-9192-f05e86adb83f.jpg',
                'api': {
                    'public': 'https://rest.simplefx.com/api/v3',
                    'private': 'https://rest.simplefx.com/api/v3',
                    'candles': 'https://candles.simplefx.com/api',
                    'utils': 'https://simplefx.com/utils'
                },
                'www': 'https://www.simplefx.com',
                'doc': [
                    'https://simplefx.com/docs/api/swagger'
                ],
            },
            'api': {
                'public': {
                    'get': [
                        '{coin}/orderbook/', // last slash critical
                        '{coin}/ticker/',
                        '{coin}/trades/',
                        '{coin}/trades/{from}/',
                        '{coin}/trades/{from}/{to}',
                        '{coin}/day-summary/{year}/{month}/{day}/',
                    ],
                    'post': [
                        'auth/key'
                    ]
                },
                'private': {
                    'get': [
                        'accounts'
                    ],
                    'post': [
                        'cancel_order',
                        'get_order',
                        'get_withdrawal',
                        'list_system_messages',
                        'trading/orders/active',
                        'list_orderbook',
                        'place_buy_order',
                        'place_sell_order',
                        'place_market_buy_order',
                        'place_market_sell_order',
                        'withdraw_coin',
                    ],
                },
                'candles': {
                    'get': [
                        'CandlesController/GetCandles',
                    ],
                },
                'utils': {
                    'get': [
                        'instruments.json',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'maker': 0.1 / 100,
                    'taker': 0.2 / 100,
                },
            },
            'limits': {
                'amount': {
                    'min': 0.000001,
                    'max': 1000000000,
                },
                'price': {
                    'min': 0.00000001,
                    'max': 1000000000,
                },
                'cost': {
                    'min': 0.00000000,
                    'max': 1000000000,
                },
            },
            'precision': {
                'amount': 8,
                'price': 8,
            },
            'options': {
                'limits': {
                    'cost': {
                        'min': {
                            'BTC': 0.0001,
                            'ETH': 0.0001,
                            'XMR': 0.0001,
                            'USDT': 1.0,
                        },
                    },
                },
            }
        });
    }

    async fetchOrderBook(symbol, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'coin': market['base'],
        };
        const response = await this.publicGetCoinOrderbook(this.extend(request, params));
        return this.parseOrderBook(response);
    }

    async fetchMarkets(params = {}) {
        const markets = await this.utilsGetInstrumentsJson();
        const keys = Object.keys(markets);
        const result = [];
        for (let i = 0; i < keys.length; i++) {
            const id = keys[i];
            const market = markets[id];
            const base = this.safeCurrencyCode(market.symbol);
            const quote = this.safeCurrencyCode(market.priceCurrency);
            const symbol = base + '/' + quote;
            const limits = this.extend(this.limits, {
                'cost': {
                    'min': this.safeValue(this.options['limits']['cost']['min'], quote),
                },
            });

            const active = true;
            result.push(this.extend(this.fees['trading'], {
                'id': id,
                'symbol': symbol,
                'baseId': base,
                'quoteId': quote,
                'base': base,
                'quote': quote,
                'active': active,
                'limits': limits,
                'info': market,
            }));
        }
        return result;
    }

    async fetchTicker(symbol, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'coin': market['base'],
        };
        const response = await this.utilsGetInstrumentsJson(this.extend(request, params));
        let ticker = response[market.id];
        const timestamp = ticker.quote.t;
        const last = ticker.quote.a;
        const price = ticker.quote.b;
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'high': undefined,
            'low': undefined,
            'bid': this.safeFloat(ticker, last),
            'bidVolume': undefined,
            'ask': this.safeFloat(ticker, price),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': undefined,
            'quoteVolume': undefined,
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
        await this.simplefxLogin();
        const response = await this.privateGetAccounts(params);
        const liveAccount = response.data.filter(a => a.reality == 'LIVE')[0];

        if (liveAccount.currency.substring(1) == "IT") {
            liveAccount.balance = liveAccount.balance / 1000000;
            liveAccount.freeMargin = liveAccount.freeMargin / 1000000;
        }

        let code = ""

        switch (liveAccount.currency) {
            case "BIT":
                code = "BTC";
                break;
            case "LIT":
                code = "LTC";
                break;
            case "EIT":
                code = "ETH";
                break;
        }

        const result = { 'info': liveAccount };
        const account = this.account();
        account['free'] = liveAccount.freeMargin;
        account['total'] = liveAccount.balance;
        account['used'] = liveAccount.balance - liveAccount.freeMargin;
        result[code] = account;

        return this.parseBalance(result);
    }

    async createOrder(symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets();
        await this.simplefxLogin();
        const request = {
            'coin_pair': this.marketId(symbol),
        };
        let method = this.capitalize(side) + 'Order';
        if (type === 'limit') {
            method = 'privatePostPlace' + method;
            request['limit_price'] = this.priceToPrecision(symbol, price);
            request['quantity'] = this.amountToPrecision(symbol, amount);
        } else {
            method = 'privatePostPlaceMarket' + method;
            if (side === 'buy') {
                if (price === undefined) {
                    throw new InvalidOrder(this.id + ' createOrder() requires the price argument with market buy orders to calculate total order cost (amount to spend), where cost = amount * price. Supply a price argument to createOrder() call if you want the cost to be calculated for you from price and amount');
                }
                request['cost'] = this.priceToPrecision(symbol, amount * price);
            } else {
                request['quantity'] = this.amountToPrecision(symbol, amount);
            }
        }
        const response = await this[method](this.extend(request, params));
        // TODO: replace this with a call to parseOrder for unification
        return {
            'info': response,
            'id': response['response_data']['order']['order_id'].toString(),
        };
    }

    async cancelOrder(id, symbol = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired(this.id + ' cancelOrder () requires a symbol argument');
        }
        await this.loadMarkets();
        await this.simplefxLogin();
        const market = this.market(symbol);
        const request = {
            'coin_pair': market['id'],
            'order_id': id,
        };
        const response = await this.privatePostCancelOrder(this.extend(request, params));
        //
        //     {
        //         response_data: {
        //             order: {
        //                 order_id: 2176769,
        //                 coin_pair: 'BRLBCH',
        //                 order_type: 2,
        //                 status: 3,
        //                 has_fills: false,
        //                 quantity: '0.10000000',
        //                 limit_price: '1996.15999',
        //                 executed_quantity: '0.00000000',
        //                 executed_price_avg: '0.00000',
        //                 fee: '0.00000000',
        //                 created_timestamp: '1536956488',
        //                 updated_timestamp: '1536956499',
        //                 operations: []
        //             }
        //         },
        //         status_code: 100,
        //         server_unix_timestamp: '1536956499'
        //     }
        //
        const responseData = this.safeValue(response, 'response_data', {});
        const order = this.safeValue(responseData, 'order', {});
        return this.parseOrder(order, market);
    }

    parseOrderStatus(status) {
        const statuses = {
            '2': 'open',
            '3': 'canceled',
            '4': 'closed',
        };
        return this.safeString(statuses, status, status);
    }

    parseOrder(order, market = undefined) {
        //
        //     {
        //         "order_id": 4,
        //         "coin_pair": "BRLBTC",
        //         "order_type": 1,
        //         "status": 2,
        //         "has_fills": true,
        //         "quantity": "2.00000000",
        //         "limit_price": "900.00000",
        //         "executed_quantity": "1.00000000",
        //         "executed_price_avg": "900.00000",
        //         "fee": "0.00300000",
        //         "created_timestamp": "1453838494",
        //         "updated_timestamp": "1453838494",
        //         "operations": [
        //             {
        //                 "operation_id": 1,
        //                 "quantity": "1.00000000",
        //                 "price": "900.00000",
        //                 "fee_rate": "0.30",
        //                 "executed_timestamp": "1453838494",
        //             },
        //         ],
        //     }
        //
        const id = this.safeString(order, 'order_id');
        let side = undefined;
        if ('order_type' in order) {
            side = (order['order_type'] === 1) ? 'buy' : 'sell';
        }
        const status = this.parseOrderStatus(this.safeString(order, 'status'));
        let symbol = undefined;
        if (market === undefined) {
            const marketId = this.safeString(order, 'coin_pair');
            market = this.safeValue(this.markets_by_id, marketId);
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const timestamp = this.safeTimestamp(order, 'created_timestamp');
        const fee = {
            'cost': this.safeFloat(order, 'fee'),
            'currency': market['quote'],
        };
        const price = this.safeFloat(order, 'limit_price');
        // price = this.safeFloat (order, 'executed_price_avg', price);
        const average = this.safeFloat(order, 'executed_price_avg');
        const amount = this.safeFloat(order, 'quantity');
        const filled = this.safeFloat(order, 'executed_quantity');
        const remaining = amount - filled;
        const cost = filled * average;
        const lastTradeTimestamp = this.safeTimestamp(order, 'updated_timestamp');
        return {
            'info': order,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'lastTradeTimestamp': lastTradeTimestamp,
            'symbol': symbol,
            'type': 'limit',
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
        if (symbol === undefined) {
            throw new ArgumentsRequired(this.id + ' fetchOrder () requires a symbol argument');
        }
        await this.loadMarkets();
        await this.simplefxLogin();
        const market = this.market(symbol);
        const request = {
            'coin_pair': market['id'],
            'order_id': parseInt(id),
        };
        const response = await this.privatePostGetOrder(this.extend(request, params));
        const responseData = this.safeValue(response, 'response_data', {});
        const order = this.safeValue(responseData, 'order');
        return this.parseOrder(order, market);
    }

    async withdraw(code, amount, address, tag = undefined, params = {}) {
        this.checkAddress(address);
        await this.loadMarkets();
        await this.simplefxLogin();
        const currency = this.currency(code);
        const request = {
            'coin': currency['id'],
            'quantity': amount.toFixed(10),
            'address': address,
        };
        if (code === 'BRL') {
            const account_ref = ('account_ref' in params);
            if (!account_ref) {
                throw new ExchangeError(this.id + ' requires account_ref parameter to withdraw ' + code);
            }
        } else if (code !== 'LTC') {
            const tx_fee = ('tx_fee' in params);
            if (!tx_fee) {
                throw new ExchangeError(this.id + ' requires tx_fee parameter to withdraw ' + code);
            }
            if (code === 'XRP') {
                if (tag === undefined) {
                    if (!('destination_tag' in params)) {
                        throw new ExchangeError(this.id + ' requires a tag argument or destination_tag parameter to withdraw ' + code);
                    }
                } else {
                    request['destination_tag'] = tag;
                }
            }
        }
        const response = await this.privatePostWithdrawCoin(this.extend(request, params));
        return {
            'info': response,
            'id': response['response_data']['withdrawal']['id'],
        };
    }

    parseOHLCV(ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        return [
            this.safeTimestamp(ohlcv, 'time'),
            this.safeFloat(ohlcv, 'open'),
            this.safeFloat(ohlcv, 'high'),
            this.safeFloat(ohlcv, 'low'),
            this.safeFloat(ohlcv, 'close'),
            this.safeFloat(ohlcv, 'size'),
        ];
    }

    async fetchOHLCV(symbol, timeframe = '5m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const request = {
            'cPeriod': this.timeframes[timeframe],
            'symbol': market['base'],
        };
        if (limit !== undefined && since !== undefined) {
            request['timeFrom'] = parseInt(since / 1000);
            request['timeTo'] = this.sum(request['timeFrom'], limit * this.parseTimeframe(timeframe));
        } else if (since !== undefined) {
            request['timeFrom'] = parseInt(since / 1000);
            request['timeTo'] = this.sum(this.seconds(), 1);
        } else if (limit !== undefined) {
            request['timeTo'] = this.seconds();
            request['timeFrom'] = request['timeTo'] - (limit * this.parseTimeframe(timeframe));
        }
        const candles = await this.candlesGetCandlesControllerGetCandles(this.extend(request, params));
        return this.parseOHLCVs(candles, market, timeframe, since, limit);
    }

    async fetchOrders(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired(this.id + ' fetchOrders () requires a symbol argument');
        }
        await this.loadMarkets();
        await this.simplefxLogin();
        const market = this.market(symbol);
        const request = {
            'coin_pair': market['id'],
        };
        const response = await this.privatePostListOrders(this.extend(request, params));
        const responseData = this.safeValue(response, 'response_data', {});
        const orders = this.safeValue(responseData, 'orders', []);
        return this.parseOrders(orders, market, since, limit);
    }

    sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/';
        const query = this.omit(params, this.extractParams(path));
        url += this.implodeParams(path, params);

        if (api === 'public' || api === 'candles' || api === 'utils') {
            if (Object.keys(query).length) {
                url += '?' + this.urlencode(query);
            }
        } else {
            this.checkRequiredCredentials();
            if (Object.keys(query).length) {
                url += '?' + this.urlencode(query);
            }
            headers = {
                'Authorization': 'Bearer ' + this.privateKey,
                'Content-Type': 'application/json'
            };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    async simplefxLogin() {
        if (this.apiKey && this.secret && !this.privateKey) {
            // let result = await this.postRequest(this.url(this.urls['api']["public"] + '/auth/key'), {
            //     "clientId": this.apiKey,
            //     "clientSecret": this.secret
            // }, {
            //         'accept': 'application/json',
            //         'Content-Type': 'application/json',
            //         'User-Agent': 'Gimmer'
            //     });

            let result = await this.request('auth/key', 'public', 'POST', {}, {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Gimmer'
            }, JSON.stringify({
                "clientId": this.apiKey,
                "clientSecret": this.secret
            }));

            return this.privateKey = result.data.token;
        }

        return;
    }

    async request(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const response = await this.fetch2(path, api, method, params, headers, body);
        if ('error_message' in response) {
            throw new ExchangeError(this.id + ' ' + this.json(response));
        }
        return response;
    }

    async postRequest(url, content, headers = null) {
        return new Promise((resolve, reject) => {
            var options = {
                url,
                headers: headers || {
                    'Content-Type': 'application/json'
                },
                json: content
            };

            request.post(options, async (err, httpResponse, result) => {
                if (err) {
                    console.log(err.stack || err.message || err);
                    reject(err.stack || err.message);
                }

                resolve(result);
            });
        })
    }
};
