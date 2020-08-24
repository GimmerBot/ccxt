from datetime import datetime
import pandas as pd
import MetaTrader5 as mt5
import sys
import json

# connect to MetaTrader 5
if not mt5.initialize():
    print("initialize() failed")
    mt5.shutdown()
 
# request connection status and parameters
# print(mt5.terminal_info())
# get data on MetaTrader 5 version
# print(mt5.version())

pair = sys.argv[1] if len(sys.argv) > 1 else 'USDBRL'
timeframe = sys.argv[2] if len(sys.argv) > 2 else mt5.TIMEFRAME_M1
startParam = sys.argv[3] if len(sys.argv) > 3 else None
endParam = sys.argv[4] if len(sys.argv) > 4 else None

start = datetime(2020,1,27,13)
end = datetime(2020,1,28,13)

if startParam is not None:
    start = datetime.utcfromtimestamp(int(startParam) / 1000)

if endParam is not None:
    end = datetime.utcfromtimestamp(int(endParam) / 1000)

rates = mt5.copy_rates_range(pair, int(timeframe), start, end)
print(json.dumps(rates.tolist()))
#print(str(pair) + '-' + str(timeframe) + '-' + str(start) + '-' + str(end))