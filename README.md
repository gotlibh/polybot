# polybot

------- BP-001 Basic Server --------

I want to create a basic app connection to an RPC provider and to have the following functionality

1. Connecting to the RPC websocket (192.168.1.10)
2. subscribe to transactions
3. subscribe to mempool
4. filter transactions by address (from, to)
5. parsing transactions
6. print transactions

My final goal is to buid a bot making arbitradge and more,
the service should be very well organized calsses and best practices,
performance is critical

later on I will add much more functionality but step by step
think of it when you organzize the service it should be in well organized

it should be very organzied and high quality code.

the code is witten in node js (not ts)
the main directory is polybot

use ethers.js
use es6 type module

any quastion or issues please ask

------- BP-002 - Expand transaction details

I want to add more transaction details,
so parse transaction to get more details about this transaction and print it.

you can ask me what details I may want

.. Basicly I want all kind of details, but I want to be able to config which data to print
if you need to change the logic how to handle it please do it, buld it as you would did it if you start it from beginning

. do you analyze also the "data" field in mempool to see what function he call and what params?

---- BP-004 - bug fix block print

In the function enrichTransaction the tx param is a hash not an object, look at the sender

------- Pending prompt

add APIs to be able to connect to the service and
add an openapi yaml file for docs or swagger it self as you understand
