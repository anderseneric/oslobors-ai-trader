from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import yfinance as yf
from dotenv import load_dotenv
import os

# Import technical indicators (install via: pip install ta-lib or use pandas_ta)
try:
    import talib
    TALIB_AVAILABLE = True
except ImportError:
    TALIB_AVAILABLE = False
    print("Warning: TA-Lib not available. Install with: pip install TA-Lib")

load_dotenv()

app = Flask(__name__)
CORS(app)

def calculate_rsi(prices, period=14):
    """Calculate RSI using pandas if TA-Lib not available"""
    if TALIB_AVAILABLE:
        return talib.RSI(prices, timeperiod=period)

    # Fallback calculation
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(prices):
    """Calculate MACD"""
    if TALIB_AVAILABLE:
        macd, signal, hist = talib.MACD(prices, fastperiod=12, slowperiod=26, signalperiod=9)
        return {'macd': macd, 'signal': signal, 'histogram': hist}

    # Fallback calculation
    exp1 = prices.ewm(span=12, adjust=False).mean()
    exp2 = prices.ewm(span=26, adjust=False).mean()
    macd = exp1 - exp2
    signal = macd.ewm(span=9, adjust=False).mean()
    histogram = macd - signal
    return {'macd': macd, 'signal': signal, 'histogram': histogram}

def calculate_bollinger_bands(prices, period=20, std_dev=2):
    """Calculate Bollinger Bands"""
    if TALIB_AVAILABLE:
        upper, middle, lower = talib.BBANDS(prices, timeperiod=period, nbdevup=std_dev, nbdevdn=std_dev)
        return {'upper': upper, 'middle': middle, 'lower': lower}

    # Fallback calculation
    sma = prices.rolling(window=period).mean()
    std = prices.rolling(window=period).std()
    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)
    return {'upper': upper, 'middle': sma, 'lower': lower}

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'talib_available': TALIB_AVAILABLE})

@app.route('/indicators/<ticker>', methods=['GET'])
def get_indicators(ticker):
    """Get technical indicators for a ticker"""
    try:
        # Add .OL suffix for Oslo Børs tickers
        ticker_symbol = f"{ticker}.OL" if not ticker.endswith('.OL') else ticker

        # Fetch historical data
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period='6mo')

        if hist.empty:
            return jsonify({'error': 'No data available'}), 404

        prices = hist['Close']

        # Calculate indicators
        rsi = calculate_rsi(prices)
        macd_data = calculate_macd(prices)
        bb = calculate_bollinger_bands(prices)

        # Get latest values
        latest_rsi = float(rsi.iloc[-1]) if not np.isnan(rsi.iloc[-1]) else None
        latest_macd = {
            'macd': float(macd_data['macd'].iloc[-1]) if not np.isnan(macd_data['macd'].iloc[-1]) else None,
            'signal': float(macd_data['signal'].iloc[-1]) if not np.isnan(macd_data['signal'].iloc[-1]) else None,
            'histogram': float(macd_data['histogram'].iloc[-1]) if not np.isnan(macd_data['histogram'].iloc[-1]) else None
        }
        latest_bb = {
            'upper': float(bb['upper'].iloc[-1]) if not np.isnan(bb['upper'].iloc[-1]) else None,
            'middle': float(bb['middle'].iloc[-1]) if not np.isnan(bb['middle'].iloc[-1]) else None,
            'lower': float(bb['lower'].iloc[-1]) if not np.isnan(bb['lower'].iloc[-1]) else None
        }

        # Calculate volume analysis
        avg_volume = float(hist['Volume'].mean())
        latest_volume = float(hist['Volume'].iloc[-1])
        volume_spike = latest_volume / avg_volume if avg_volume > 0 else 0

        return jsonify({
            'ticker': ticker,
            'latest_price': float(prices.iloc[-1]),
            'rsi': latest_rsi,
            'macd': latest_macd,
            'bollinger_bands': latest_bb,
            'volume': {
                'current': latest_volume,
                'average': avg_volume,
                'spike_ratio': volume_spike
            },
            'timestamp': hist.index[-1].isoformat()
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/screener', methods=['POST'])
def run_screener():
    """Run screener on multiple tickers"""
    try:
        data = request.json
        tickers = data.get('tickers', [])
        criteria = data.get('criteria', {})

        rsi_min = criteria.get('rsi_min', 30)
        rsi_max = criteria.get('rsi_max', 70)
        volume_spike = criteria.get('volume_spike', 1.5)

        results = []

        for ticker in tickers:
            try:
                ticker_symbol = f"{ticker}.OL"
                stock = yf.Ticker(ticker_symbol)
                hist = stock.history(period='3mo')

                if hist.empty:
                    continue

                prices = hist['Close']
                rsi = calculate_rsi(prices)
                latest_rsi = float(rsi.iloc[-1])

                avg_volume = float(hist['Volume'].mean())
                latest_volume = float(hist['Volume'].iloc[-1])
                vol_spike = latest_volume / avg_volume if avg_volume > 0 else 0

                # Check criteria
                if rsi_min <= latest_rsi <= rsi_max and vol_spike >= volume_spike:
                    results.append({
                        'ticker': ticker,
                        'price': float(prices.iloc[-1]),
                        'rsi': latest_rsi,
                        'volume_spike': vol_spike,
                        'score': (100 - abs(50 - latest_rsi)) + (vol_spike * 10)
                    })

            except Exception as e:
                print(f"Error processing {ticker}: {e}")
                continue

        # Sort by score
        results.sort(key=lambda x: x['score'], reverse=True)

        return jsonify({
            'results': results[:10],
            'total_scanned': len(tickers),
            'matches': len(results)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PYTHON_PORT', 5000))
    app.run(debug=True, port=port, host='0.0.0.0')
