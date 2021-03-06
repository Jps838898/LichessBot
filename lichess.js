// ==UserScript==
// @name         Lichess Bot
// @description  Fully automated lichess bot
// @author       You
// @include      *lichess*
// @require https://raw.githubusercontent.com/Jps838898/LichessBot/master/Engines/stockfish11.0.1.asm.js
// @run-at document-start
// @grant        none
// ==/UserScript==

var stockfish = STOCKFISH();
var isWhite = false;
var fen = "";
var gameStarted = false;

initialise();

async function initialise()
{
while (!gameStarted || typeof lichess.socket == 'undefined')
{
    await sleep(1000);
    // Get color information and initial FEN from html
    var documentPlayerString = document.documentElement.innerHTML.split("player\":{\"color\":\"")[1].split("\"")[0];
    gameStarted = documentPlayerString == "white" || documentPlayerString == "black";
    isWhite = documentPlayerString == "white";
}

getInitialFen();

    if (isMyTurn())
{
makeMove();
}
}

function replaceAll(str, find, replace)
{
return str.replace(new RegExp(find, 'g'), replace);
}

function findNewOpponent()
{
var buttons = document.getElementsByClassName("button");
var i;
for (i = 0; i < buttons.length; i++)
{
if (buttons[i].outerHTML.includes("hook")) // hook or pool
{
buttons[i].click();
return true;
}
}
return false;
}

function isMyTurn()
{
return (isWhite && fen.includes(" w")) || (!isWhite && fen.includes(" b"));
}

// Extract FEN from html
function getInitialFen()
{
    var fensHtml = document.documentElement.innerHTML.split("fen");
    fen = fensHtml[fensHtml.length - 1].split("\"}]")[0].substring(3).split("\"")[0];
}

// Intercept inputs from websockets
var ws = window.WebSocket;
window.WebSocket = function (a, b)
{
    var that = b ? new ws(a, b) : new ws(a);

    that.addEventListener("message", function (e)
    {
    // If game is over then search for new game
        findNewOpponent();

        var message = JSON.parse(e.data);
        if (typeof message.d != 'undefined' && typeof message.v != 'undefined' && typeof message.d.fen != 'undefined')
        {
            // Note : this fen is not complete, it only contains the first field
            fen = message.d.fen;

            // add player to move to fen
            var isWhitesTurn = message.v % 2 == 0;
            if (isWhitesTurn)
            {
                fen += " w";
            }
            else
            {
                fen += " b";
            }
            if (isMyTurn())
            {
            makeMove();
            }
            return;
        }

    });
    return that;
};
window.WebSocket.prototype = ws.prototype;


// Send request to stockfish
function makeMove()
{
// Look at stockfish.js documentation to add more nerfs / customisations to stockfish here
stockfish.postMessage("position fen " + fen);
stockfish.postMessage("setoption name Skill Level value " + 6);
stockfish.postMessage("setoption name nodestime value " + 2500);
stockfish.postMessage("setoption name Ponder value " + false);
stockfish.postMessage("go"); // stockfish response will trigger a move
}

function sleep(ms)
{
  return new Promise(resolve => setTimeout(resolve, ms));
}


// Response from stockfish js -> move
stockfish.onmessage = async function(event) {
	    if (event && event.includes("bestmove"))
	    {
            var newScore = parseInt(event.split("score")[1])&&parseInt(event.split("cp ")[1]);
	    	var bestMove = replaceAll(event.split("bestmove")[1], " ", "");
	    	var moveTime = "y";		// set moveTime = "0" for pre-move abuse!
 	    	if (typeof score != 'undefined')
	    	if (typeof newScore != 'undefined')
	    	{
                // If we see a centipawn difference then pretend to think, if we see no difference, move faster.
	    		if (Math.abs(newScore - score) > 100)
	    		{
                    // You can alter how much Math.random is being multiplied by to change how fast you want a large chunk of your moves to be
                    var sleepTime = ((Math.random() * 10) + .55) * 1000;
	    			moveTime = "0";
	    			await sleep(sleepTime);
	    		}
	    		else if (newScore == score)
	    		{
                    // Pre Moving
                    moveTime = "0";
	    		}
                else
                {
                    // Fast Moving
                    var sleepTime = ((Math.random() * 1.5) + .15) * 1000;
	    			moveTime = "0";
                    await sleep(sleepTime);
                }
 	    		// auto resign - not needed for ultra bullet
	   			// if (newScore < -600)
				// {
				// 	lichess.socket.send("resign");
				// }
	    	}
 	    	score = newScore;
 	    	// Send websocket move request to lichess server
	    	lichess.socket.send("move",{"u":bestMove});
	    	lichess.socket.send("move",{"u":bestMove,"s":moveTime});
	    }
	};