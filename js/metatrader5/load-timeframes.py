from datetime import datetime
import pandas as pd
import MetaTrader5 as mt5
import sys
import json

# connect to MetaTrader 5
if not mt5.initialize():
    print("initialize() failed")
    mt5.shutdown()

timeframes = '{        "1m": ' + str(mt5.TIMEFRAME_M1) + ',        "3m": ' + str(mt5.TIMEFRAME_M3) + ',        "5m": ' + str(mt5.TIMEFRAME_M5) + ',        "15m": ' + str(mt5.TIMEFRAME_M15) + ',        "30m": ' + str(mt5.TIMEFRAME_M30) + ',        "1h": ' + str(mt5.TIMEFRAME_H1) + ',        "2h": ' + str(mt5.TIMEFRAME_H2) + ',        "4h": ' + str(mt5.TIMEFRAME_H4) + ',        "6h": ' + str(mt5.TIMEFRAME_H6) + ',        "8h": ' + str(mt5.TIMEFRAME_H8) + ',        "12h": ' + str(mt5.TIMEFRAME_H12) + ',        "1d": ' + str(mt5.TIMEFRAME_D1) + ',        "1w": ' + str(mt5.TIMEFRAME_W1) + ',        "1M": ' + str(mt5.TIMEFRAME_MN1) + '    }'

print(timeframes)
