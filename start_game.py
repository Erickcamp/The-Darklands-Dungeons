import http.server, webbrowser, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = 8000
webbrowser.open(f'http://localhost:{port}/darklands_game.html')
http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=port)
