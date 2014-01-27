UnexpectedCharacterError = new Error("Unexpected character");
UnexpectedTokenError = new Error("Unexpected token");
UnrecognizedRuleType = new Error("Unrecognized rule type");

$(".editor-button").click(function() {
	$("#formula-raw").selection("insert", {"text": $(this).attr("title"), mode: "before"});
});

$("#show-labels").change(function() {
	if (r !== null) r.draw();
});

s4 = function() {
	return Math.floor( (1 + Math.random() ) * 0x10000)
		.toString(16)
		.substring(1);
};

guid = function() {
	return (
		s4() + s4() + '-' +
		s4() + '-' +
		s4() + '-' + s4() + '-' +
		s4() + s4() + s4()
	);
};

mouseOver = function(o_title) {
	$("svg").attr("title", o_title);
};

mouseOut = function() {
	$("svg").attr("title", "");
};

drawTree = function(o_root) {
	$("#drawing").html("<svg></svg>");

	var width  = 600,
			height = 600;

	var cluster  = d3.layout.tree().size([height - 30, width - 30]);
	var diagonal = d3.svg.diagonal().projection(function(d) {
		return [d.x, d.y];
	});

	var svg = d3.select("svg").append("g")
		.attr("transform", "translate(15, 15)");

	var nodes = cluster.nodes(o_root);
	var links = cluster.links(nodes);

	var link = svg.selectAll("pathlink")
		.data(links)
		.enter().append("path")
		.attr("class", "link")
		.attr("d", diagonal);

	var node = svg.selectAll(".node")
		.data(nodes)
		.enter().append("g")
		.attr("class", function(d) {
			var result = "node ";
			if (d.is_leaf) {
				result += "leaf ";

				if (d.is_closed) {
					result += "closed";
				} else {
					result += "opened";
				}
			};

			return result;
		})
		.attr("transform", function(d) {
			return "translate(" + d.x + "," + d.y + ")";
		});

	node.append("circle").attr("r", 5)
		.attr("onmouseout", function(d) {
			return "mouseOut()";
		})
		.attr("onmouseover", function(d) {
			return "mouseOver('" + d.title + "')";
		});

	if ( $("#show-labels").is(":checked") ) {
		node.append("text").attr("dx", 10).text(function(d) {
			return d.title;
		});
	}
};

Symbols = {
	And  : "\u2227",
	Or   : "\u2228",
	Equ  : "\u21D4",
	Imp  : "\u21D2",
	Not  : "\u00AC",
	Alpha: "\u03B1",
	Beta : "\u03B2"
};

// enum TokenType
TokenType = {
	Id  : 1,
	And : 2,
	Or  : 3,
	Equ : 4,
	Imp : 5,
	Not : 6,
	Lpar: 7,
	Rpar: 8,
	Eof : 9
};

// class Token
Token = function(o_type, o_value) {
	this.type  = o_type ;
	this.value = o_value;
};

// class Lexer
Lexer = function(o_input) {
	var _keywords = {
		"and": TokenType.And,
		"or" : TokenType.Or,
		"equ": TokenType.Equ,
		"imp": TokenType.Imp,
		"not": TokenType.Not
	};

	var _operators = {
		"(": TokenType.Lpar,
		")": TokenType.Rpar
	};

	var _ignore = [
		" ",
		"\n",
		"\t"
	];

	var _input = o_input;
	var _idx = 0;
	var _len = o_input.length;

	// public function print()
	Lexer.prototype.print = function() {
		var res = "";
		var tok = this.next();

		while (tok.type != TokenType.Eof) {
			if (tok.type == TokenType.Id) {
				res += "" + tok.value + "";
			} else {
				res += "";
				
				switch (tok.type) {

				case TokenType.And:
					res += Symbols.And;
				break;

				case TokenType.Or:
					res += Symbols.Or;
				break;

				case TokenType.Equ:
					res += Symbols.Equ;
				break;

				case TokenType.Imp:
					res += Symbols.Imp;
				break;

				case TokenType.Not:
					res += Symbols.Not;
				break;

				case TokenType.Lpar:
					res += "(";
				break;

				case TokenType.Rpar:
					res += ")";
				break;
				
				default:
					throw new Exception("Unexpected token");
				}

				res += "";
			}
			tok = this.next();
		}

		res += "";
		_idx = 0;

		return res;
	};

	// public function next()
	Lexer.prototype.next = function() {

		while (true) {
			// end of input
			if (_idx >= _len) return new Token(TokenType.Eof, null);
			var c = _input[_idx];

			// operator
			if (c in _operators) {
				_idx += 1;
				return new Token(_operators[c], c);

			// keyword or operator
			} else if ( /[a-z]/i.test(c) ) {
				id = "";
				do {
					id += c;
					_idx += 1;
					c = _input[_idx];
				} while ( _idx < _len && /[a-z]/i.test(c) );

				if (id in _keywords) {
					return new Token(_keywords[id], id);
				} else {
					return new Token(TokenType.Id, id);
				}

			// syntax error
			} else if (_ignore.indexOf(c) == -1) {
				throw UnexpectedCharacterError;

			// ignored character
			} else {
				_idx += 1;
				continue;
			}
		};
	}
}

NodeType = {
	Id : 1,
	Not: 2,
	Imp: 3,
	Equ: 4,
	And: 5,
	Or : 6
};

// Rules
// -------------------------------------------------
// | not not A     | A             |               |
// | A and B       | A             | B             |
// | not (A or B)  | not A         | not B         |
// | not (A imp B) | A             | not B         |
// | A equ B       | A imp B       | B imp A       |
// ------------------------------------------------|
// | not (A and B) | not A         | not B         |
// | A or B        | A             | B             |
// | B imp B       | not A         | B             |
// | not (A equ B) | not (A imp B) | not (B imp A) |
// -------------------------------------------------

// class NodeExprId
NodeExprId = function(o_id) {
	this.type = NodeType.Id;
	this.id   = o_id;

	// public function print()
	NodeExprId.prototype.print = function() {
		return this.id;
	};
};

// class NodeExprNot
NodeExprNot = function(o_node) {
	this.type = NodeType.Not;
	this.node = o_node;

	// public function print()
	NodeExprNot.prototype.print = function() {
		return Symbols.Not + this.node.print();
	};
};

// class NodeExprImp
NodeExprImp = function(o_left, o_right) {
	this.type  = NodeType.Imp; 
	this.left  = o_left;
	this.right = o_right;

	// public function print()
	NodeExprImp.prototype.print = function() {
		return (
			"(" + this.left.print() +
			" " + Symbols.Imp + " " +
			this.right.print() + ")"
		);
	};
};

// class NodeExprEqu
NodeExprEqu = function(o_left, o_right) {
	this.type  = NodeType.Equ;
	this.left  = o_left;
	this.right = o_right;

	// public function print()
	NodeExprEqu.prototype.print = function() {
		return (
			"(" + this.left.print() +
			" " + Symbols.Equ + " " +
			this.right.print() + ")"
		);
	};
};

// class NodeExprOr
NodeExprOr = function(o_left, o_right) {
	this.type  = NodeType.Or;
	this.left  = o_left;
	this.right = o_right;

	// public function print()
	NodeExprOr.prototype.print = function() {
		return (
			"(" + this.left.print() +
			" " + Symbols.Or + " " +
			this.right.print() + ")"
		);
	};
}

// class NodeExprAnd
NodeExprAnd = function(o_left, o_right) {
	this.type  = NodeType.And;
	this.left  = o_left;
	this.right = o_right;

	// public function print()
	NodeExprAnd.prototype.print = function() {
		return (
			"(" + this.left.print() +
			" " + Symbols.And + " " +
			this.right.print() + ")"
		);
	};
};

// class Parser
Parser = function(o_lexer) {
	var _lexer = o_lexer;
	var _token = o_lexer.next();

	// private function _next()
	var _next = function() {
		_token = _lexer.next();
	}

	// private function _parseExprImp()
	var _parseExprImp = function() {
		return _parseExprImpCompl( _parseExprEqu() );
	}

	// private function _parseExprImpCompl(Node o_node)
	var _parseExprImpCompl = function(o_node) {
		var n = o_node;
		var e = null;

		if (_token.type == TokenType.Imp) {
			_next();
			e = _parseExprEqu();
			n = _parseExprImpCompl( new NodeExprImp(n, e) );
		}

		return n;
	}

	// private function _parseExprEqu()
	var _parseExprEqu = function() {
		return _parseExprEquCompl( _parseExprOr() );
	}

	// private function _parseExprEqu(Node o_node)
	var _parseExprEquCompl = function(o_node) {
		var n = o_node;
		var e = null;

		if (_token.type == TokenType.Equ) {
			_next();
			e = _parseExprOr();
			n = _parseExprEquCompl( new NodeExprEqu(n, e) );
		}

		return n;
	}

	// private function _parseExprOr()
	var _parseExprOr = function() {
		return _parseExprOrCompl( _parseExprAnd() );
	}

	// private function _parseExprOrCompl(Node o_node)
	var _parseExprOrCompl = function(o_node) {
		var n = o_node;
		var e = null;

		if (_token.type == TokenType.Or) {
			_next();
			e = _parseExprAnd();
			n = _parseExprOrCompl( new NodeExprOr(n, e) );
		}

		return n;
	}

	// private function _parseExprAnd()
	var _parseExprAnd = function() {
		return _parseExprAndCompl( _parseExprNot() );
	}

	// private function _parseExprAndCompl(Node o_node)
	var _parseExprAndCompl = function(o_node) {
		var n = o_node;
		var e = null;

		if (_token.type == TokenType.And) {
			_next();
			e = _parseExprNot();
			n = _parseExprAndCompl( new NodeExprAnd(n, e) );
		}

		return n;
	}

	// private function _parseExprNot()
	var _parseExprNot = function() {
		if (_token.type == TokenType.Not) {
			_next();
			var e = _parseExprNot();
			return new NodeExprNot(e);
		} else {
			return _parseExprPrimary();
		}
	}

	// private function _parseExprPrimary()
	var _parseExprPrimary = function() {
		var n = null;

		if (_token.type == TokenType.Id) {
			n = new NodeExprId(_token.value);
			_next();
			return n;
		} else if (_token.type == TokenType.Lpar) {
			_next();
			n = _parseExprImp();
			if (_token.type != TokenType.Rpar) {
				throw UnexpectedTokenError;
			}
			_next();
			return n;
		} else {
			throw UnexpectedTokenError;
		}
	}

	// public function parse()
	Parser.prototype.parse = function() {
		var result = _parseExprImp();
		if (_token.type !== TokenType.Eof) {
			throw UnexpectedTokenError;
		}
		return result;
	}
};

// enum RuleType
RuleType = {
	Literal: 1,
	NotNot : 2,
	Alpha  : 3,
	Beta   : 4
};

var ruleTypeToString = function(o_type) {
	switch (o_type) {
	
	case RuleType.Literal:
		return "var";

	case RuleType.Alpha:
		return Symbols.Alpha;

	case RuleType.Beta:
		return Symbols.Beta;

	case RuleType.NotNot:
		return Symbols.Not + Symbols.Not;

	default:
		throw UnrecognizedRuleType;
	}
};

// enum RuleResult
RuleResult = function(o_rule, o_left, o_right) {
	this.rule  = o_rule;
	this.left  = o_left;
	this.right = o_right;
};

// class Register
Register = function(o_label, o_vertex, o_branch) {
	this.label  = o_label ;
	this.vertex = o_vertex;
	this.branch = o_branch;
	this.is_del = false   ;
	this.id     = guid()  ;
}

TreeNode = function(o_root, o_address, o_parent) {
	this.address   = o_address;
	this.node      = o_root;
	this.title     = this.node.print();
	this.children  = new Array( );
	this.parent    = o_parent;
	this.is_closed = false;
	this.is_leaf   = false;

	if (typeof this.parent === "undefined") {
		this.parent = null;
	}

	TreeNode.prototype.draw = function() {
		drawTree(this);
	};

	TreeNode.prototype.collectBranch = function() {
		var result = new Array( );
		if (this.node.type == NodeType.Not) {
			if (this.node.node.type == NodeType.Id) {
				result.push(this.node);
			}
		} else if (this.node.type == NodeType.Id) {
			result.push(this.node);
		}

		if (this.parent !== null) {
			result = result.concat( this.parent.collectBranch() );
		}

		return result;
	};

	TreeNode.prototype.checkBranch = function() {
		var branch = this.collectBranch();

		for (var i = 0; i < branch.length; i++) {
			for (var j = i + 1; j < branch.length; j++) {
				if ( branch[i].type == NodeType.Not && branch[j].type == NodeType.Id) {
					if (branch[i].node.id == branch[j].id) return this.is_closed = true;
				}
				
				if (branch[i].type == NodeType.Id && branch[j].type == NodeType.Not) {
					if (branch[i].id == branch[j].node.id) return this.is_closed = true;
				}
			}
		}

		return false;
	};

	TreeNode.prototype.findLeaves = function() {
		if (this.children.length == 0) {
			this.is_leaf = true;
			return [ this ];
		} else if (this.children.length == 1) {
			return this.children[0].findLeaves();
		} else {
			return this.children[0].findLeaves().concat (
				this.children[1].findLeaves()
			);
		}
	};

	TreeNode.prototype.append = function(o_node, o_address) {
		var bit = o_address[this.address.length];
		if (this.address.length + 1 == o_address.length) {
			var tree_node = new TreeNode(o_node, o_address, this);
			this.children.push(tree_node);
		} else {
			if (bit == "0") {
				this.children[0].append(o_node, o_address);
			} else {
				this.children[1].append(o_node, o_address);
			}
		}
	};

	TreeNode.prototype.check = function() {
		var leaves = this.findLeaves();
		var result = true;

		for (var i in leaves) {
			if ( leaves.hasOwnProperty(i) ) {
				var branch_result = leaves[i].checkBranch();
				result = result && branch_result;
			}
		}

		return result;
	};
}

// class Tableaux
Tableaux = function(o_node) {

	var _registers = new Array( );
	var _vertices  = new Array( );
	var _node = o_node;

	// public function printRegisters()
	Tableaux.prototype.printRegisters = function() {
		$(".registers tbody").html("");
		for (i in _registers) {
			if (!_registers[i].is_del) {
				var rule_type = ruleTypeToString(_rule(_registers[i].label).rule);
				var tr = "<td>" + _registers[i].label.print() + "</td>";
				tr = "<td class=\"r\">" + _registers[i].branch + "</td>" + tr;
				tr = "<td class=\"r\">" + _registers[i].vertex + "</td>" + tr;
				tr = tr + "<td class=\"r\">" + rule_type + "</td>";
				tr = $("<tr data-id=\"" + _registers[i].id + "\">" + tr + "</tr>");
				$(".registers tbody").append(tr);
			}
		}
	};

	// private function _getAllUnusedRegisters()
	var _getAllUnusedRegisters = function() {
		var filtred = _registers.filter(function(o_register) {
			return o_register.is_del == false;
		});

		return filtred;
	};

	// private function _getUnusedRegister()
	var _getUnusedRegister = function() {
		var filtred = _getAllUnusedRegisters();

		if (filtred.length > 0) {
			return filtred[0];
		} else {
			return null;
		}
	};

	// private function _getRegistesrFromBranch(String o_branch)
	var _getRegistersFromBranch = function(o_branch) {
		var registers = _getAllUnusedRegisters();
		var branch = o_branch;

		var filtred = registers.filter(function(o_register) {
			return o_register.branch == o_branch;
		});

		return filtred;
	};

	var _addRegister = function(o_register) {
		if (_rule(o_register.label).rule != RuleType.Literal) {
			_registers.push(o_register);
		}

		_vertices[o_register.vertex] = o_register.label;
	}

	// private function _find(id)
	var _find = function(o_id) {
		for (i in _registers) {
			if (_registers[i].id == o_id) {
				return _registers[i];
			}
		}

		return null;
	};

	// private function _rule(Node o_node)
	var _rule = function(o_node) {
		switch (o_node.type) {

		case NodeType.Not:
			var node = o_node.node;

			switch (node.type) {

			case NodeType.Not:
				return new RuleResult (
					RuleType.NotNot,
					node.node,
					null
				);

			case NodeType.And:
				return new RuleResult (
					RuleType.Beta,
					new NodeExprNot(node.left),
					new NodeExprNot(node.right)
				);

			case NodeType.Equ:
				return new RuleResult (
					RuleType.Beta,
					new NodeExprNot (
						new NodeExprImp (
							node.left,
							node.right
						)
					),
					new NodeExprNot (
						new NodeExprImp (
							node.right,
							node.left
						)
					)
				);

			case NodeType.Imp:
				return new RuleResult (
					RuleType.Alpha,
					node.left,
					new NodeExprNot(node.right)
				);

			case NodeType.Or:
				return new RuleResult (
					RuleType.Alpha,
					new NodeExprNot(node.left),
					new NodeExprNot(node.right)
				);

			default:
				return new RuleResult(RuleType.Literal, o_node, null);
			}

		case NodeType.And:
			return new RuleResult (
				RuleType.Alpha,
				o_node.left,
				o_node.right
			);

		case NodeType.Equ:
			return new RuleResult (
				RuleType.Alpha,
				new NodeExprImp (
					o_node.left,
					o_node.right
				),
				new NodeExprImp (
					o_node.right,
					o_node.left
				)
			);

		case NodeType.Imp:
			return new RuleResult (
				RuleType.Beta,
				new NodeExprNot(o_node.left),
				o_node.right
			);

		case NodeType.Or:
			return new RuleResult(RuleType.Beta, o_node.left, o_node.right);
		
		default:
			return new RuleResult(RuleType.Literal, o_node, null);
		}
	};

	// public function apply(Node o_node)
	Tableaux.prototype.apply = function(o_index) {

		var register;
		if (typeof o_index === "undefined") {
			register = _getUnusedRegister();
		} else {
			register = _find(o_index);
		}

		if (register === null) return null;
		var result = _rule(register.label);

		// remove register
		register.is_del = true;

		// alpha rule
		if (result.rule == RuleType.Alpha) {

			// modify existing registers
			var registers = _getRegistersFromBranch(register.branch);
			for (i in registers) {
				if (registers[i].vertex != register.vertex) {
					registers[i].branch = register.branch + "00";
				}
			}

			// insert new registers
			_addRegister (
				new Register (
					result.left,
					register.branch + "0",
					register.branch + "00"
				)
			);

			_addRegister (
				new Register (
					result.right,
					register.branch + "00",
					register.branch + "00"
				)
			);

		// beta rule
		} else if (result.rule == RuleType.Beta) {

			// modify existing registers
			var registers = _getRegistersFromBranch(register.branch);
			for (i in registers) {
				if (registers[i].vertex != register.vertex) {
					_registers.push (
						new Register (
							registers[i].label,
							registers[i].vertex,
							register.branch + "1"
						)
					);
					registers[i].branch = register.branch + "0";
				}
			}

			// insert new registers
			_addRegister (
				new Register (
					result.left,
					register.branch + "0",
					register.branch + "0"
				)
			);

			_addRegister (
				new Register (
					result.right,
					register.branch + "1",
					register.branch + "1"
				)
			);

		// double negation
		} else if (result.rule == RuleType.NotNot) {

			// modify existing registers
			var registers = _getRegistersFromBranch(register.branch);
			for (i in registers) {
				if (registers[i].vertex != register.vertex) {
					registers[i].branch = registers[i].branch + "0";
				}
			}

			// insert new registers
			_addRegister (
				new Register (
					result.left,
					register.branch + "0",
					register.branch + "0"
				)
			);
		}

		_registers.sort(function(a, b) {
			var ra = _rule(a.label);
			var rb = _rule(b.label);

			if (ra.rule == RuleType.Alpha && rb.rule == RuleType.Beta) {
				return -1;
			} else if (ra.rule == RuleType.Beta && rb.rule == RuleType.Alpha) {
				return 1;
			}

			return parseInt(a.vertex, 2) > parseInt(b.vertex, 2);
		});
		this.printRegisters();

		if (_getAllUnusedRegisters().length == 0) return null;
		return register;
	}

	Tableaux.prototype.print = function() {

		$("#formula-formatted").html("");
		var tree = null;

		var _keys = new Array( );

		for (i in _vertices) {
			_keys.push(i);
		}
		_keys.sort();

		for (j in _keys) {
			if ( _keys.hasOwnProperty(j) ) {
				var i = _keys[j];
				if ( _vertices.hasOwnProperty(i) ) {
					if (tree === null) {
						tree = new TreeNode(_vertices[i], i);
					} else {
						tree.append(_vertices[i], i);
					}
				}
			}
		}

		return tree;
	};

	_addRegister( new Register(new NodeExprNot(o_node), "0", "0") );
};

var t = null;
var r = null;
step = function() {
	if (t === null) {
		clearTimeout();
		return;
	}

	n = t.apply();
	r = t.print();
	if ( n !== null ) {
		r.draw();
		setTimeout("step()", 1000);
	} else {
		if ( r.check() ) {
			$("#result").text("JEST TAUTOLOGIĄ");
			$("#result").addClass("tautology");
		} else {
			$("#result").text("NIE JEST TAUTOLOGIĄ");
			$("#result").removeClass("tautology");
		}
		r.draw();
		t = null;
	}
}

prepare = function() {
	$("#result").text("");
	$("#result").removeClass("tautology");
	try {
		var l = new Lexer( $("#formula-raw").val() );
		console.log(l.print());
		var p = new Parser(l);
		var n = p.parse();

		t = new Tableaux(n);
		return t;
	} catch(e) {
		alert("Podane wyrażenie jest niepoprawne.");
		return null;
	} finally {
	}
};

auto = function() {
	if (t === null) {
		var p = prepare();
		if (p === null) return;
		r = t.print();
		r.draw();
	}
	setTimeout("step()", 1000);
};

$("#formula-raw").focus(function() {
	t = null;
});

$("form").submit(function(event) {
	auto();
	event.preventDefault();
});

$("#auto").click(function(event) {
	event.preventDefault();
	auto();
});

$("#step").click(function(event) {
	event.preventDefault();
	if (t === null) {
		var p = prepare();
		if (p === null) return;
		r = t.print();
		r.draw();
		t.printRegisters();
	} else {
		var n = t.apply();
		r = t.print();
		if (n === null) {
			if ( r.check() ) {
				$("#result").text("JEST TAUTOLOGIĄ");
				$("#result").addClass("tautology");
			} else {
				$("#result").text("NIE JEST TAUTOLOGIĄ");
				$("#result").removeClass("tautology");
			}
			t = null;
		}
		r.draw();
	}
});

$("table").on("click", function(event) {
	var tr = $(this).find("tr:hover");
	var n = t.apply( tr.attr("data-id") );
	r = t.print()

	if (n === null) {
		if ( r.check() ) {
			$("#result").text("JEST TAUTOLOGIĄ");
			$("#result").addClass("tautology");
		} else {
			$("#result").text("NIE JEST TAUTOLOGIĄ");
			$("#result").removeClass("tautology");
		}
		t = null;
	}
	r.draw();
});
