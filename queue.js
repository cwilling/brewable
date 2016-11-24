/* Extended from:
  https://code.tutsplus.com/articles/data-structures-with-javascript-stack-and-queue--cms-23348
*/


function Queue(options) {
    var options = options || {};
    this._interval = options.interval || 1000; //milliseconds
    this._name = options.name || 'unnamed queue';
    this._action = options.action || function() {console.log('No action');};

    this._oldestIndex = 1;
    this._newestIndex = 1;
    this._storage = {};


    console.log(this._name + " starting with interval " + this._interval);
}
module.exports = Queue;
 
Queue.prototype.size = function() {
    return this._newestIndex - this._oldestIndex;
};
 
Queue.prototype.enqueue = function(data) {
    this._storage[this._newestIndex] = data;
    this._newestIndex++;
};
 
Queue.prototype.dequeue = function() {
    var oldestIndex = this._oldestIndex,
        newestIndex = this._newestIndex,
        deletedData;
 
    if (oldestIndex !== newestIndex) {
        deletedData = this._storage[oldestIndex];
        delete this._storage[oldestIndex];
        this._oldestIndex++;
 
        return deletedData;
    }
};
 
Queue.prototype.start = function() {
  setInterval( function() {
    //console.log("\nChecking queue");
    this._action();

    if (this.size > 0) {
      message = this.dequeue();
      console.log("Sending msg: " + messsage);
      /*
      for (var c=0;c<clients.length();c++) {
      }
      */
    }
  }.bind(this), this._interval);

};



/* ex:set ai shiftwidth=2 inputtab=spaces smarttab noautotab: */
