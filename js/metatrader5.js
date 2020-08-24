'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require('./base/Exchange');
const { ExchangeError } = require('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class metatrader5 extends Exchange {
    describe() {
        return this.deepExtend(super.describe(), {
            'id': 'metatrader5',
            'name': 'MetaTrader5',
            'countries': ['BR'], // Brazil
            'rateLimit': 200,
            'version': 'v2',
            'has': {
                'CORS': true,
                'createMarketOrder': false,
                'createOrder': false,
                'cancelOrder': false,
                'cancelOrders': false,
                'fetchBalance': false,
                'fetchOrder': false,
                'fetchOrders': false,
                'fetchOrderBook': false,
                'fetchOHLCV': true,
                'fetchMarkets': true,
                'fetchTicker': false,
                'fetchTrades': false
            },
            'timeframes': {
                '1m': '1',
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
                'logo': 'https://c.mql5.com/i/logo_mql5-2.png',
                'api': {
                    'public': 'https://api.metatrader5cx.com/public',
                    'broker': 'https://broker.metatrader5cx.com/apiv2',
                    'private': 'https://api.metatrader5cx.com/private',
                },
                'www': 'https://broker.metatrader5cx.com',
                'doc': [
                    'https://docs.metatrader5cx.com/?version=latest',
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
        const result = (await new Promise(async (resolve, reject) => {
            const pairsPy = new PythonShell(path.join(__dirname, 'python/load-pairs.py'));
            pairsPy.on('message', function (message) {
                // received a message sent from the Python script (a simple "print" statement)
                const pairsSource = JSON.parse(message);

                const pairs = asEnumerable(pairsSource).Where(c => c[3]).Select((p, i) => {
                    return {
                        symbol: p[85] + "/" + p[86],
                        base: p[85],
                        quote: p[86],
                        id: p[85] + p[86],
                        baseId: p[85],
                        quoteId: p[86],
                        active: true,
                        info: p
                    }
                }).ToArray();

                resolve(pairs);
            });
        }));
        return result;
    }

    async fetchOHLCV(symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);

        const ohlcv = (await new Promise(async (resolve, reject) => {
            const request = {
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

            const pairsPy = new PythonShell(path.join(__dirname, 'python/load-ohlcv.py'), { args: [market.id, this.timeframes[timeframe], request['from'].toString(), request['to'].toString()] });
            pairsPy.on('message', function (message) {
                // received a message sent from the Python script (a simple "print" statement)
                const ohlcvSource = JSON.parse(message);

                const ohlcv = asEnumerable(ohlcvSource).Select((p, i) => {
                    return [
                        p[0] * 1000,
                        p[1],
                        p[2],
                        p[3],
                        p[4],
                        p[5]
                    ]
                }).ToArray();

                resolve(ohlcv);
            });
        }));

        return ohlcv;
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
