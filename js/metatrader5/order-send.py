from datetime import datetime
import pandas as pd
import MetaTrader5 as mt5
import sys
import json

# connect to MetaTrader 5
if not mt5.initialize():
    mt5.shutdown()

symbol = sys.argv[1] if len(sys.argv) > 1 else 'EURUSD'
timeframe = sys.argv[2] if len(sys.argv) > 2 else mt5.TIMEFRAME_M1
startParam = sys.argv[3] if len(sys.argv) > 3 else None
endParam = sys.argv[4] if len(sys.argv) > 4 else None

# prepare the buy request structure
symbol_info = mt5.symbol_info(symbol)
if symbol_info is None:
    mt5.shutdown()
    quit()
 
# if the symbol is unavailable in MarketWatch, add it
if not symbol_info.visible:
    if not mt5.symbol_select(symbol,True):
        mt5.shutdown()
        quit()
 
lot = 0.1
point = mt5.symbol_info(symbol).point
price = mt5.symbol_info_tick(symbol).ask
deviation = 20
request = {
    "action": mt5.TRADE_ACTION_DEAL,
    "symbol": symbol,
    "volume": lot,
    "type": mt5.ORDER_TYPE_BUY,
    "price": price,
    "sl": price - 100 * point,
    "tp": price + 100 * point,
    "deviation": deviation,
    "magic": 234000,
    "comment": "python script open",
    "type_time": mt5.ORDER_TIME_GTC,
    "type_filling": mt5.ORDER_FILLING_RETURN,
}
 
# send a trading request
result = mt5.order_send(request)
# check the execution result
if result.retcode != mt5.TRADE_RETCODE_DONE:
    mt5.shutdown()
    quit()
 
print(json.dumps(result))
