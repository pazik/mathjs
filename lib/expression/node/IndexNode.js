var number= require('../../util/number.js'),

    Node = require('./Node.js'),
    RangeNode = require('./RangeNode.js'),
    SymbolNode = require('./SymbolNode.js'),

    BigNumber = require('bignumber.js'),
    Index = require('../../type/Index.js'),
    Range = require('../../type/Range.js'),

    isNumber = number.isNumber,
    toNumber = number.toNumber;

/**
 * @constructor IndexNode
 * get a subset of a matrix
 * @param {Node} object
 * @param {Node[]} ranges
 */
function IndexNode (object, ranges) {
  this.object = object;
  this.ranges = ranges;
}

IndexNode.prototype = new Node();

/**
 * Compile the node to javascript code
 * @param {Object} defs     Object which can be used to define functions
 *                          or constants globally available for the compiled
 *                          expression
 * @return {String} js
 * @private
 */
IndexNode.prototype._compile = function (defs) {
  return this.compileSubset(defs);
};

/**
 * Compile the node to javascript code
 * @param {Object} defs           Object which can be used to define functions
 *                                or constants globally available for the
 *                                compiled expression
 * @param {String} [replacement]  If provided, the function returns
 *                                  "math.subset(obj, math.index(...), replacement)"
 *                                Else, the function returns
 *                                  "math.subset(obj, math.index(...))"
 * @return {String} js
 * @returns {string}
 */
IndexNode.prototype.compileSubset = function compileIndex (defs, replacement) {
  // check whether any of the ranges expressions uses the context symbol 'end'
  var filter = {
    type: SymbolNode,
    properties: {
      name: 'end'
    }
  };
  var rangesUseEnd = this.ranges.map(function (range) {
    return range.find(filter).length > 0;
  });

  // TODO: implement support for bignumber (currently bignumbers are silently
  //       reduced to numbers when changing the value to zero-based)

  // TODO: Optimization: when the range values are ConstantNodes,
  //       we can beforehand resolve the zero-based value

  var ranges = this.ranges.map(function(range, i) {
    var useEnd = rangesUseEnd[i];
    if (range instanceof RangeNode) {
      if (useEnd) {
        // resolve end and create range (change from one based to zero based)
        return '(function (scope) {' +
            '  scope = Object.create(scope); ' +
            '  scope["end"] = size[' + i + '];' +
            '  var step = ' + (range.step ? range.step._compile(defs) : '1') + ';' +
            '  return [' +
            '    ' + range.start._compile(defs) + ' - 1, ' +
            '    ' + range.end._compile(defs) + ' - (step > 0 ? 0 : 2), ' +
            '    step' +
            '  ];' +
            '})(scope)';
      }
      else {
        // create range (change from one based to zero based)
        return '(function () {' +
            '  var step = ' + (range.step ? range.step._compile(defs) : '1') + ';' +
            '  return [' +
            '    ' + range.start._compile(defs) + ' - 1, ' +
            '    ' + range.end._compile(defs) + ' - (step > 0 ? 0 : 2), ' +
            '    step' +
            '  ];' +
            '})()';
      }
    }
    else {
      if (useEnd) {
        // resolve the parameter 'end', adjust the index value to zero-based
        return '(function (scope) {' +
            '  scope = Object.create(scope); ' +
            '  scope["end"] = size[' + i + '];' +
            '  return ' + range._compile(defs) + ' - 1;' +
            '})(scope)'
      }
      else {
        // just evaluate the expression, and change from one-based to zero-based
        return range._compile(defs) + ' - 1';
      }
    }
  });

  // if some parameters use the 'end' parameter, we need to calculate the size
  var someUseEnd = ranges.some(function (useEnd) {
    return useEnd;
  });
  if (someUseEnd) {
    return '(function () {' +
        '  var obj = ' + this.object._compile(defs) + ';' +
        '  var size = math.size(obj).valueOf();' +
        '  return math.subset(' +
        '    obj, ' +
        '    math.index(' + ranges.join(', ') + ')' +
        '    ' + (replacement ? (', ' + replacement) : '') +
        '  );' +
        '})()';
  }
  else {
    return 'math.subset(' +
        this.object._compile(defs) + ',' +
        'math.index(' + ranges.join(', ') +
        (replacement ? (', ' + replacement) : '') +
        ')';
  }
};

/**
 * Find all nodes matching given filter
 * @param {Object} filter  See Node.find for a description of the filter options
 * @returns {Node[]} nodes
 */
IndexNode.prototype.find = function (filter) {
  var nodes = [];

  // check itself
  if (this.match(filter)) {
    nodes.push(this);
  }

  // search object
  if (this.object) {
    nodes = nodes.concat(this.object.find(filter));
  }

  // search in parameters
  var ranges = this.ranges;
  if (ranges) {
    for (var i = 0, len = ranges.length; i < len; i++) {
      nodes = nodes.concat(ranges[i].find(filter));
    }
  }

  return nodes;
};

/**
 * Get the name of the object linked to this IndexNode
 * @return {string} name
 */
IndexNode.prototype.objectName = function objectName () {
  return this.object.name;
};

/**
 * Get string representation
 * @return {String} str
 */
IndexNode.prototype.toString = function() {
  // format the parameters like "[1, 0:5]"
  var str = this.object ? this.object.toString() : '';
  if (this.ranges) {
    str += '[' + this.ranges.join(', ') + ']';
  }
  return str;
};

module.exports = IndexNode;