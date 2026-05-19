# Preferred Pick System

I built this as an attempt to mirror the system we currently have on a small scale so that myself and Gavin (Glasgow stock guy) could see if this was something that we'd find beneficial.

The idea behind it was as Glasgow is a small team everyone does a little bit of everything and no one, excluding myself ;), can remember where everything lives at all times so this does the heavy lifting for us. Which I think makes the inbound process more efficeint and user friendly while also improving the flow of the warehouse. This with a small change to how SKUs are ordered in the pick scan screen would reduce pick times and increase our productivity.

Basically the code allows the inbound team to set and store home locations for SKUs and a threshold quantity that these SKUs should remain above.

A report can then be made that gives an instantaneous to do list of what SKU needs topped up and where to get them, this means there would be less replenishing of stock during the day which would further reduce time spent picking.

I've set this up using nodejs to run a local host but also used ngrok to test the scanning functions on my phone.

I understand this code is no where near where it needs to be but this was a fun wee side project for me until now. If I had some more time I'd love to get the JS out of the HTML file as it's a bit of a mess.