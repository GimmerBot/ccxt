from datetime import datetime
import pandas as pd
import MetaTrader5 as mt5
import json
 
# connect to MetaTrader 5
if not mt5.initialize():
    print("initialize() failed")
    mt5.shutdown()

symbols = mt5.symbols_get()

print(json.dumps(symbols))