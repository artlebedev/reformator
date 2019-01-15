// Reformator 2.0
// Copyright Art. Lebedev | http://www.artlebedev.ru/
// License: BSD | http://opensource.org/licenses/BSD-3-Clause
// Author: Vladimir Tokmakov | vlalek
// Updated 2019-01-15


var reformator = {
	auto: function(params){
		if(!params){
			params = {};
		}
		if(!params.class_name){
			params.class_name = '(X?HTML|x?html)';
		}
		this.init_by_tag('textarea', params);
		this.init_by_tag('input', params);
	}

	, forms: []
	, children: []
	, elements_by_tag_name: {}
	, elements_by_class_name: {nbsp: {}}
	, sidebar_file_name: 'sidebar.html'
	, editor_file_name: 'editor.css'

	, init_class: function(params){
		this[params.name] = {};
		this[params.name].object = params.object;
		this[params.name].object.prototype = params.prototype;
	}

	, init: function(params){
		if(!params){
			params = {};
		}
		if(!this.inited){
			if(!reformator.html.inited){
				reformator.html.init();
			}

			for(var s in this){
				if(this.constructor.prototype[s]) continue;
				if(this[s].init){
					this[s].init();
				}
			}
		}

		if(params.root_path){
			this.root_path = params.root_path;
		}else{
			var
				script_elements = document.getElementsByTagName('script')
				, matches
				, i = 0
			;
			while(i < script_elements.length && !matches){
				matches = script_elements[i].src.match(/^(.*)reformator.*\.js$/);
				i++;
			};
			this.root_path = matches ? matches[1]: './';
		}
		if(params.css_path){
			this.css_path = params.css_path;
		}else{
			this.css_path = this.root_path + this.editor_file_name;
		}
		if(params.bar_path){
			this.bar_path = params.bar_path;
		}else{
			this.bar_path = this.root_path + this.sidebar_file_name;
		}

		var ua = navigator.userAgent.toLowerCase();
		var match = /(webkit)[ \/]([\d]*)/.exec(ua)
			|| /(opera)(?:.*version)?[ \/]([\d]*)/.exec(ua)
			|| /(msie) ([\d]*)/.exec(ua)
			|| ua.indexOf('compatible') < 0 && /(mozilla)(?:.*? rv:([\d]*))?/.exec(ua)
			|| ['', '', ''];

		this.browser = {name: match[1], mversion: match[2]};
		//alert(this.browser.name + ' ' + this.browser.mversion)

		this.inited = true;
	}

	, init_by_tag: function(tag_name, params){
		var from_element = params.from_element? params.from_element: document;
		var elements = from_element.getElementsByTagName(tag_name);
		for(var i = 0; i < elements.length; i++){
			if(
				reformator.dom_element.has_class(elements[i], params.class_name)
				&& !reformator.dom_element.has_class(elements[i], 'reformator_source')
			){
				this.append(elements[i], params);
			}
		}
	}

	, append: function(element, params){
		if(!this.inited){
			this.init(params);
		}
		var editor = new reformator.editor(element, params);
		if(editor && editor.element && editor.element.parentNode){
			this.children[this.children.length] = editor;
			var form_element = reformator.dom_element.get_first_ancestor_element(element, 'form');
			if(form_element){
				var append = true;
				for(var i = 0; i < this.forms.length; i++){
					if(this.forms[i].element == form_element){
						append = false;
						this.forms[i].children[this.forms[i].children.length] = editor;
					}
				}
				if(append){
					var form_object = {element: form_element, children: [editor]};
					this.forms[this.forms.length] = form_object;
					reformator.dom_element.add_event_listener(
						form_element
						, 'submit'
						, function(){
							for(var i = 0; i < form_object.children.length; i++){
								form_object.children[i].on_submit();
							}
						}
					);
				}
			}
			if(!this.bar.created && params && params.bar){
				this.bar.create();
			}
		}
		return editor;
	}

	, remove: function(element){
		for(var i = 0; i < this.children.length; i++){
			if(this.children[i].source.element == element){
				this.children[i].destroy();
			}
		}
	}
};


reformator.js = {};


reformator.js.is_array = ('isArray' in Array)
	? Array.isArray 
	: function (value){
		return Object.prototype.toString.call(value) === '[object Array]';
	};


reformator.editor = function(element, params){
	//try{
		if(element.reformator){
			return element.reformator;
		}
		element.reformator = this;
		this.create(element, params);
	//}catch(error){
	//	this.destroy();
	//}
};


reformator.editor.prototype = {
	create: function(element, params){
		this.init_variables();
		var p = {}, s;
		if(params){for(s in params){p[s] = params[s];}}
		if(typeof(p.inline_only) == 'undefined' && (element.tagName.toLowerCase() == 'input' || reformator.dom_element.has_class(element, '(inline|INLINE)'))){
			p.inline_only = true;
		}
		if(p.inline_only && !p.control_class){
			p.control_class = 'inline';
		}
		for(s in p){
			if(p.constructor.prototype[s]) continue;
			if(
				typeof(this[s]) == 'undefined'
				|| typeof(this[s]) == p[s]
			){
				this[s] = p[s];
			}
		}
		if(element.id){
			var labels = document.getElementsByTagName('label');
			for(var i = 0; i < labels.length; i++){
				if(labels[i].htmlFor == element.id){
					this.label = labels[i];
					break;
				}
			}
		}
		this.overflow = reformator.dom_element.get_style(element, 'overflow');
		this.element = this.make(element);
		this.element.reformator = this;
		this.source = new reformator.source(element);

		var text = this.source.get();
		if(text && (text.indexOf(this.autotypograph_cancel_label) > -1 || text.indexOf(this.autoclear_cancel_label) > -1)){
			this.set_autoformat(false);
		}

		this.wysiwyg = new reformator.wysiwyg(this, this.element.getElementsByTagName('iframe')[0], text, p);

		this.resizer = {element: this.element.getElementsByTagName('ins')[0]};

		var t = this;
		setTimeout(// For IE 6, FF 2
			function(){
				t.init();
				if(params.focus){
					setTimeout(// For IE 7, FF 3.6
						function(){
							try{// For FF 1.5
								t.wysiwyg.selection.select_node(t.wysiwyg.document.body);
								t.wysiwyg.selection.collapse(true);
								t.wysiwyg.focus();
							}catch(e){};
						}
						, 300
					);
				}
			}
			, 0
		);

		if(!reformator.dom_element.has_class(document.body.parentNode, 'with_reformator')){
			reformator.dom_element.add_class(document.body.parentNode, 'with_reformator');
		}
	}

	, destroy: function(){
		if(this.element && this.element.parentNode && this.source && this.source.element){
			this.element.parentNode.insertBefore(this.source.element, this.element);
			this.source.element.className = this.element.className.replace(/\sreformator\S*/g, '');
			var style = this.element.getAttribute('style');
			reformator.dom_element.set_style(this.source.element, style && style.cssText? style.cssText: style);
			this.element.parentNode.removeChild(this.element);
		}
	}

	, init_variables: function(){
		this.autoformat = true;
		this.autotypograph = true;
		this.autotypograph_cancel_label = '<!-- no autotypograph -->';
		this.autoclear = true;
		this.autoclear_cancel_label = '<!-- no autoclear -->';
	}

	, make: function(element){
		var layer = document.createElement('div');
		var style = element.getAttribute('style');
		reformator.dom_element.set_style(layer, style && style.cssText? style.cssText: style);
		reformator.dom_element.set_style(element, '');

		layer.className = element.className + ' reformator reformator_inactive';
		element.className = 'reformator_source';

		layer.innerHTML = '<iframe frameborder="no" class="reformator_wysiwyg" style="display: none;"></iframe><div class="min"></div><ins class="resizer"></ins>';
		layer.unselectable = 'on';
		element.parentNode.insertBefore(layer, element);
		layer.appendChild(element);

		return layer;
	}

	, init: function(){
		var t = this;

		this.resizer.resize = function(event){
			t.element.style.height = t.resizer.start.height + reformator.dom_element.get_coords(event).top - t.resizer.start.top + 'px';
			t.resized = true;
		};

		reformator.dom_element.add_event_listener(
			this.resizer.element
			, 'mousedown'
			, function(event){
				reformator.dom_element.add_class(t.resizer.element, 'resizer_active');
				t.resizer.start = {top: reformator.dom_element.get_coords(event).top, height: t.element.offsetHeight};
				reformator.dom_element.add_event_listener(
					document
					, 'mousemove'
					, t.resizer.resize
				);
				reformator.dom_element.add_event_listener(
					document
					, 'mouseup'
					, function(event){
						reformator.dom_element.remove_class(t.resizer.element, 'resizer_active');
						reformator.dom_element.remove_event_listener(
							document
							, 'mousemove'
							, t.resizer.resize
						);
					}
				);
				reformator.dom_element.cancel_event(event);
			}
		);

		this.current = this.wysiwyg;
		this.actived = true;

		this.init_input_events(true);
	}

	, init_input_events: function(with_source){
		var t = this;

		if(with_source){
			reformator.dom_element.add_event_listener(
				this.source.element
				, [
					'mouseup'
					, 'keyup'
					, 'drop'
					, 'paste'
				]
				, function(event){
					t.set_edited(true);
				}
			);

			reformator.dom_element.add_event_listener(
				this.source.element
				, 'focus'
				, function(){
					t.on_focus(t.wysiwyg, t.source);
				}
			);
		}


		var elements = [window.addEventListener? this.wysiwyg.window: this.wysiwyg.document];
		if(with_source){
			elements[elements.length] = this.source.element;
		}
		reformator.dom_element.add_event_listener(
			elements
			, 'keydown'
			, function(event){
				event = reformator.dom_element.normalize_event(event);
				if(
					event.ctrlKey
					&& event.altKey
				){
					if(event.key_code == 13){
						// ctrl+alt+enter
						t.set_maximize(!t.maximize);
						t.focus();
					}else if(event.key_code == 85){
						// ctrl+alt+u
						t.set_active(!t.actived);
						t.focus();
					}
				}
			}
		);

		var elements = [this.wysiwyg.window];
		if(window.addEventListener){
			elements[elements.length] = this.wysiwyg.document;
		}
		reformator.dom_element.add_event_listener(
			elements
			, 'focus'
			, function(){
				t.wysiwyg.set_design_mode(); // For FF 2
				t.on_focus(t.source, t.wysiwyg);
			}
		);

		if(with_source){
			elements[elements.length] = this.source.element;
		}
		reformator.dom_element.add_event_listener(
			elements
			, 'blur'
			, function(event){
				t.on_blur();
			}
		);

		setTimeout(
			function(){
				reformator.dom_element.remove_class(t.element, 'reformator_inactive');
				t.wysiwyg.element.style.display = 'block';
				//if(t.overflow == 'visible'){
					function init_resize(){
						if(t.wysiwyg.document.body.scrollHeight && t.element.offsetHeight){
							function resize(){
								if(t.resized){return;}
								if(t.wysiwyg.document.body.scrollHeight > t.element.offsetHeight){
									t.element.style.height = t.wysiwyg.document.body.scrollHeight + 20 + 'px';
								}else{
									var height = t.wysiwyg.document.body.offsetHeight > t.wysiwyg.document.body.scrollHeight ? t.wysiwyg.document.body.scrollHeight : t.wysiwyg.document.body.offsetHeight; // For IE
									if(height + 50 < t.element.offsetHeight){
										t.element.style.height = height + 50 + 'px';
									}
								}
							};
							resize();
							reformator.dom_element.add_event_listener(
								window.addEventListener? t.wysiwyg.window: t.wysiwyg.document,
								['keyup', 'mouseup', 'DOMAttrModified', 'selectionchange'],
								resize
							);
						}else{
							setTimeout(init_resize, 500);
						}
					};
					//init_resize();
					setTimeout(init_resize, 500);
				//}
			}
			, 0
		);
	}

	, set_active: function(actived){
		this.actived = actived;
		if(this.actived){
			this.current = this.wysiwyg;
		}else{
			this.current = this.source;
		}
	}

	, focus: function(){
		this.current.focus();
	}

	, on_focus: function(from_reformator, to_reformator){
		if(!this.focused){
			if(
				reformator.current
				&& reformator.current != this
			){
				reformator.current.on_blur();
			}
			reformator.current = this;
			this.focused = true;
			if(this.control_class && reformator.control.element){
				reformator.dom_element.add_class(reformator.control.element, this.control_class);
			}
			reformator.dom_element.add_class(this.element, 'reformator_current');
			if(from_reformator.edited){
				to_reformator.set(from_reformator.get());
				from_reformator.set_edited(false);
			}
			reformator.dom_element.replace_class(this.element, 'reformator_inactive', '', !this.actived);
			if(this.actived){
				// For IE
				this.wysiwyg._update_selection();
			}else{
				reformator.control.refresh();
			}
		}
	}

	, on_blur: function(){
		if(this.focused){
			this.focused = false;
			reformator.dom_element.remove_class(this.element, 'reformator_current');
			if(this.control_class && reformator.control.element){
				reformator.dom_element.remove_class(reformator.control.element, this.control_class);
			}
			reformator.control.refresh();
		}
		window.status = '';
	}

	, on_submit: function(){
		if(this.wysiwyg.edited){
			this.source.set(this.wysiwyg.get());
		}
		this.actived = false;
		this.current = this.source;
		var i = this.source.element.value ? this.source.element.value.indexOf(this.autotypograph_cancel_label) : -1;
		if(this.autotypograph){
			if(this.edited){
				this.typograph();
			}
			if(i > -1){
				this.source.element.value = this.source.element.value.substr(0, i);
			}
		}else if(i == -1){
			this.source.element.value += this.autotypograph_cancel_label;
		}
		i = this.source.element.value ? this.source.element.value.indexOf(this.autoclear_cancel_label) : -1;
		if(this.autoclear){
			if(this.edited){
				this.clear();
			}
			if(i > -1){
				this.source.element.value = this.source.element.value.substr(0, i);
			}
		}else if(i == -1){
			this.source.element.value += this.autoclear_cancel_label;
		}
	}

	, set_autoformat: function(value){
		this.autoformat = value;
		this.set_autotypograph(value);
		this.set_autoclear(value);
	}

	, set_autotypograph: function(value){
		this.autotypograph = value;
	}

	, set_autoclear: function(value){
		this.autoclear = value;
	}

	, set_maximize: function(value){
		this.maximize = value;
		if(this.wysiwyg.window.getSelection && this.actived){ // For FF 4 -- fix losing cursor
			var selection = this.wysiwyg.window.getSelection(), saved_selection = selection ? selection.getRangeAt(0) : null;
			this.source.element.focus();
		}
		if(this.maximize){
			reformator.dom_element.add_class(document.body, 'reformator_maximize');
			reformator.dom_element.add_class(this.element, 'reformator_maximized');
			if(this.label){
				reformator.dom_element.add_class(this.label, 'reformator_maximized_label');
				reformator.dom_element.add_class(this.element, 'reformator_maximized_with_label');
			}
		}else{
			reformator.dom_element.remove_class(document.body, 'reformator_maximize');
			reformator.dom_element.remove_class(this.element, 'reformator_maximized');
			if(this.label){
				reformator.dom_element.remove_class(this.label, 'reformator_maximized_label');
				reformator.dom_element.remove_class(this.element, 'reformator_maximized_with_label');
			}
		}
		if(this.wysiwyg.window.getSelection){ // For FF 4 -- fix losing cursor
			for(var i = 0; i < reformator.children.length; i++){
				reformator.children[i].wysiwyg.document.body.contentEditable = false;
				reformator.children[i].wysiwyg.document.body.contentEditable = true;
			}
			if(this.actived){
				selection = this.wysiwyg.window.getSelection();
				selection.removeAllRanges();
				selection.addRange(saved_selection);
				this.focus();
			}
		}
	}

	, typograph: function(){
		this.set(reformator.typograph.process(this.get(), this.typograph_params));
	}

	, clear: function(){
		if(this.actived){
			this.wysiwyg.clear();
		}else{
			if(this.source.edited){
				this.wysiwyg._set(this.source.get());
				this.wysiwyg.set_edited(false);
			}
			this.wysiwyg.clear();
			if(this.wysiwyg.edited){
				this.source.set(this.wysiwyg.get());
			}
		}
	}

	, on_wysiwyg_change: function(){
		if(this.synchronize_timeout){
			clearTimeout(this.synchronize_timeout);
		}
		if(!this.wysiwyg || this.not_edit){return;}
		var t = this;
		this.synchronize_timeout = setTimeout(
			function(){
				if(t.wysiwyg.edited){
					t.source.set(t.wysiwyg.get());
					t.wysiwyg.set_edited(false);
					t.not_edit = true;
					reformator.dom_element.fire_event(t.source.element, 'keyup');
					t.not_edit = false;
				}
			}
			, 3000 - 9000000 / (t.wysiwyg.document.body.scrollHeight + 3000)
		);
	}

	, get: function(){
		return this.current.get();
	}

	, set: function(text){
		this.current.set(text);
		this.set_edited(true);
	}

	, set_edited: function(edited){
		this.edited = edited;
		if(this.current){
			this.current.set_edited(edited);
		}
	}
};


reformator.source = function(element){
	this.element = element;
};

reformator.source.prototype = {
	focus: function(){
		this.element.focus();
	}

	, get: function(){
		return this.element.value;
	}

	, set: function(text){
		this.element.value = text? text: '';
	}

	, set_edited: function(edited){
		this.edited = edited;
	}
};


reformator.wysiwyg = function(editor, element, text, params){
	this.editor = editor;
	this.element = element;
	this.create(text, params);
};

reformator.wysiwyg.prototype = {
	create: function(text, params){
		this.init_variables();

		if(params){
			for(var s in params){
				if(params.constructor.prototype[s]) continue;
				if(
					typeof(this[s]) == 'undefined'
					|| typeof(this[s]) == params[s]
				){
					this[s] = params[s];
				}
			}
		}

		this.window = this.element.contentWindow;
		this.document = this.window.document;

		this.make(text);

		this.ancestors = [];

		this.selection = new reformator.dom_selection(this.window);

		this.undo = new reformator.wysiwyg_undo(this);

		if(!text){
			this.set_empty();
			this.set_edited(true);
		}

		this.init();
	}

	, init_variables: function(){
		this.nbsp_tag_pattern = /<nobr[^>]*class="nbsp"[^>]*>([^<]*?)<\/nobr>/g;
		this.nbsp_pattern = new RegExp(
			'('
			+ reformator.html.entities.common.nbsp[0]
			+ '|' + reformator.html.entities.common.nbsp[1]
			+ '|' + reformator.html.entities.common.nbsp[2]
			+ '|' + reformator.html.entities.common.nbsp[3]
			+ ')(?![^<>]{0,200}>)'
			, 'g'
		);
		this.shy_pattern = new RegExp(
			'('
			+ reformator.html.entities.common.shy[0]
			+ '|' + reformator.html.entities.common.shy[1]
			+ '|' + reformator.html.entities.common.shy[2]
			+ '|' + reformator.html.entities.common.shy[3]
			+ ')(?![^<>]{0,200}>)'
			, 'g'
		);
		this.empty_pattern = new RegExp(
			'^([\\s\\n\\r]'
			+ '|' + reformator.html.entities.common.nbsp[0]
			+ '|' + reformator.html.entities.common.nbsp[1]
			+ '|' + reformator.html.entities.common.nbsp[2]
			+ '|' + reformator.html.entities.common.nbsp[3]
			+ '|' + reformator.html.entities.common.shy[0]
			+ '|' + reformator.html.entities.common.shy[1]
			+ '|' + reformator.html.entities.common.shy[2]
			+ '|' + reformator.html.entities.common.shy[3]
			+ ')*$'
		);
		this.nbsp_patterns = new RegExp(
			'(\\s*'
			+ reformator.html.entities.common.nbsp[0]
			+ '\\s*|\\s*' + reformator.html.entities.common.nbsp[1]
			+ '\\s*|\\s*' + reformator.html.entities.common.nbsp[2]
			+ '\\s*|\\s*' + reformator.html.entities.common.nbsp[3]
			+ '\\s*){2,}'
			, 'g'
		);
	}

	, make: function(text){
		this.document.open();
		this.document.write(
			'<html><style type="text/css">'
			+ '.nbsp {/*user-select: none; -moz-user-select: none; -khtml-user-select: none; -webkit-user-select: none;*/ height: 1em;} '
			+ (
				(reformator.browser.name == 'webkit' && reformator.browser.mversion > 531)
				|| (reformator.browser.name == 'mozilla' && reformator.browser.mversion > 5)
				|| (reformator.browser.name == 'opera' && reformator.browser.mversion > 10)
				? '#reformator_selection_0, #reformator_selection_1 {display: none;} '
				: ''
			)
			//+ (reformator.browser.name != 'msie'
			//	? 'table, p, ul, ol, li, dl, dt, dd, h1, h2, h3, h4, h5, h6, div, form, address, blockquote, ins, del {min-height: 1.2em;} '
			//	: ''
			//)
			//+ '#reformator_selection_0, #reformator_selection_1 {display: inline; border-left: 1px solid red; height: 1em; margin: 0 1px;} '
			+ 'table, img {width: auto ! important; height: auto ! important;} '
			+ 'table, td, th {border: 0 transparent; margin: 0;} '
			+ 'table {empty-cells: show; border-spacing: 0; border-collapse: collapse; border-left: 1px solid; border-top: 1px solid;} '
			+ 'th, td {border-right: 1px solid; border-bottom: 1px solid;}'
			+ '</style><link rel="stylesheet" type="text/css" href="' + reformator.css_path + '" /><body class="reformator">' + this.preprocess(text) + '</body></html>'
		);
		this.document.close();
		this._cancel_submit(this.document.getElementsByTagName('form'));
	}

	, init: function(){
		var t = this;

		var elements = window.addEventListener? this.window: this.document;

		reformator.dom_element.add_event_listener(
			elements
			, 'unload'
			, function(){
				var text = t.get();
				setTimeout(function(){
					if(!t.element.contentWindow){
						return;
					}
					t.design_mode = false;
					t.create(text);
					t.editor.init_input_events();
				}, 0);
				return false;
			}
		);

		reformator.dom_element.add_event_listener(
			elements
			, 'keydown'
			, function(event){
				event = reformator.dom_element.normalize_event(event);
				reformator.key_code = event.keyCode;
				if(event.ctrlKey || event.metaKey){
					if(
						event.key_code == 89
						|| (event.altKey && event.key_code == 90)
						|| (event.shiftKey && event.key_code == 90)
					){
						// ctrl+y ctrl+alt+z
						t.undo.forward();
						reformator.dom_element.cancel_event(event);
					}else if(event.key_code == 90){
						//ctrl+z
						t.undo.backward();
						reformator.dom_element.cancel_event(event);
					}
				}else if(
					event.key_code == 9
					&& t.ancestors_path
					&& t.ancestors_path.match(/(\s|^)pre([\s\.]|$)/i)
				){
					// tab pressed in <pre>
					t.insert('\t');
					reformator.dom_element.cancel_event(event);
				}else if(event.key_code == 8 || event.key_code == 46 || event.key_code == 37 || event.key_code == 39){
					// backspace, delete, left, right
					// for FF
					for(var i = 0, n; i < 2; i++){
						n = t.document.getElementById('reformator_selection_' + i);
						if(n){
							n.parentNode.removeChild(n);
						}
					}
				}
			}
		);

		function on_change(event){
			if(event.key_code == 32 || event.key_code >= 48){
				if(event.ctrlKey || event.metaKey){
					if(event.key_code == 86 || event.key_code == 88){
						// ctrl+v ctrl+x
						t.undo.store();
					}
				}else{
					t.undo.store({as_sequence: true});
				}
			}else if(event.key_code == 8 || event.key_code == 46){
				t.undo.store({as_sequence: true, as_remove: true});
			}else{
				t.undo.store();
			}
			t._update_selection();
		};
		this.selection.add_on_change_function(on_change);

		if(t.inline_only){
			reformator.dom_element.add_event_listener(
				elements
				, window.addEventListener? 'keypress': 'keydown' // Opera need keypress
				, function(event){
					event = reformator.dom_element.normalize_event(event);
					if(event.key_code == 13){
						reformator.dom_element.cancel_event(event);
					}
				}
			);
		}

		reformator.dom_element.add_event_listener(
			elements
			, 'keyup'
			, function(event){
				event = reformator.dom_element.normalize_event(event);
				if(
					event.key_code == 1
					|| (
						event.key_code > 32
						&& event.key_code < 41
					)
				){
					//!t.wysiwyg._update_selection();
				}else{
					if(event.key_code == 13){
						// enter
						//!t.wysiwyg._update_selection();
						t.check_for_paragraph();
					}else if(
						(
							(event.ctrlKey || event.metaKey)
							&& event.key_code == 86
						) || (
							(event.keyCode == 91 || event.keyCode == 93)
							&& reformator.key_code == 86
						)
					){
						// ctrl+v
						if(t.editor.autoclear){
							t._format_clear();
						}
						//t._update_selection();
					}else if(
						//(
						//	!t.wysiwyg.ancestors.length
						//) && (
							event.key_code == 46
							|| event.key_code == 8
							|| (
								event.ctrlKey
								&& event.key_code == 88
							)
						//)
					){
						// backspace, delete or ctrl+x
						//if(t.document.body.childNodes.length < 10){
							// For Chrome & Safari
							//if(t.editor.autoclear){
								//t._format_clear();
								// lose focus in Chrome
							//}
						//}
						//!t.wysiwyg._update_selection();
					}else if(event.key_code == 72 && event.altKey && event.ctrlKey && document.location.href.match(/vlalek/)){
						//ctrl+alt+h
						alert(t.document.body.innerHTML);
					}else if(event.key_code == 68 && event.altKey && event.ctrlKey && document.location.href.match(/vlalek/)){
						//ctrl+alt+d
						var s = t.selection.get_start_node();
						var e = t.selection.get_end_node();
						var c = reformator.dom_element.get_common_sibling_nodes(s, e), cs = '';
						if(c){
							for(var i = 0; i < c.length; i++){
								cs+='\n---\n'+(c[i].tagName ? c[i].tagName : c[i].nodeValue);
							}
						}
						alert(window.sss + '\n-------------------------------\n' + (s.tagName ? (s.tagName == 'INS' ? s.parentNode.innerHTML : s.tagName) : s.nodeValue) + '\n->\n' + (e.tagName ? (e.tagName == 'INS' ? e.parentNode.innerHTML : e.tagName) : e.nodeValue) + '\n-------------------------------\n' + cs);
					}
					t.set_edited(true);
					//!t.on_wysiwyg_change();
				}
			}
		);

		this.set_design_mode();
	}

	, set_design_mode: function(){
		if(!this.design_mode){
			try{
				if((this.document.body.contentEditable + '') == 'false' || (this.document.body.contentEditable + '') == 'inherit'){
					this.document.body.contentEditable = true;
				}else{
					this.document.designMode = 'on';
				}
				var t = this;
				setTimeout(function(){
					try{
						t.document.execCommand('enableObjectResizing', false, 'false');
						t.document.execCommand('enableInlineTableEditing', false, 'false');
					}catch(error){
					};
				}, 500);
			}catch(error){
				return false;
			};
			this.design_mode = true;
		}
	}

	, set: function(text){
		var selection = this.store_selection();
		this._set(text);
		this.restore_selection(selection);
		this.undo.store();
	}

	, _set: function(text){
		if(text){
			this.document.body.innerHTML = this.preprocess(text);
			this._cancel_submit(this.document.getElementsByTagName('form'));
		}else{
			this.set_empty();
		}
	}

	, preprocess: function(text){
		return text? text.replace(this.nbsp_pattern, '<nobr class="nbsp" unselectable="on">' + reformator.html.entities.common.nbsp[0] + '</nobr>').replace(/(<nobr[^>]*>[^<]*)<nobr[^>]*>([^<]*)<\/nobr>/g, '$1$2').replace(/<\/table>(?=(\s*<\/[a-z\d]+>|<!--.*?-->)*\s*$)/g, '</table>&nbsp;'): '';
	}

	, get: function(){
		return reformator.dom_element.get_inner_html(this.document.body).replace(this.nbsp_tag_pattern, function(s, s1){return s1.replace(/\s+/g, '&nbsp;');}).replace(this.nbsp_pattern, '&nbsp;').replace(/(^\s+|\s+$)/g, '').replace(/<br\s*\/>\s*($|<\/p>)/, '$1').replace(/\s*<p>(\s*<br\s*\/>\s*)?<\/p>\s*/g, '').replace(this.shy_pattern, '&shy;');
	}

	, focus: function(){
		if(window.addEventListener){
			this.element.focus(); // For Safari, but not for IE 8
		}
		this.window.focus();
	}

	, check_for_paragraph: function(){
		if(!this.inline_only && (!this.ancestors || !this.ancestors.length)){
			this.format({selector: {elements: [{tag_name: 'p'}]}});
			this._update_selection();
		}
	}

	, clear: function(){
		this._format_clear();
		this.undo.store();
		this._update_selection();
	}

	, insert: function(html_begin, html_end, contents_as_text, as_block){
		if(this.selection.selection && this.selection.selection.type == 'Control'){
			this.selection.select_node(this.selection.range.item(0));
		}
		this.focus(); // For IE 8
		this._update_selection(); // For IE 8
		if(!html_end){
			if(this.selection.range.pasteHTML){
				this.selection.range.pasteHTML('');
			}else{
				this.selection.range.deleteContents();
			}
			this.selection.collapse(true);
		}
		if(html_end && (as_block || !this.selection.collapsed())){
			var new_elements = as_block ? this._format_block({tag_name: 'div'}) : this._format_inline({tag_name: 'span'});
			if(new_elements){
				for(var i = 0; i < new_elements.length; i++){
					new_elements[i].innerHTML = html_begin + (html_end ? (contents_as_text? new_elements[i].innerText || new_elements[i].textContent || ' ' : new_elements[i].innerHTML) + html_end : '');
					this._replace_element_by_null(new_elements[i]);
				}
			}
		}else{
			if(this.selection.range.pasteHTML){
				var in_pre = false;
				if(
					this.ancestors_path
					&& this.ancestors_path.match(/(\s|^)pre([\s\.]|$)/i)
				){
					html_begin = html_begin ? html_begin.replace(/(\t+)/g, '<pre id="reformator_tab" style="display: inline">$1</pre>') : '';
					html_end = html_end ? html_end.replace(/(\t+)/g, '<pre id="reformator_tab" style="display: inline">$1</pre>') : '';
					in_pre = true;
				}
				this.selection.range.pasteHTML(html_begin + (html_end ? html_end: ''));
				if(in_pre){
					while(tab = this.document.getElementById('reformator_tab')){
						this._replace_element_by_null(tab);
					}
				}
			}else{
				// For Chrome 8 & Safari which have bug with insertHTML
				var new_element = this.document.createElement('span');
				new_element.innerHTML = html_begin + (html_end ? html_end: '');
				this.selection.range.insertNode(new_element);
				this.selection.select_node(new_element);
				this.selection.collapse(false);
				this._replace_element_by_null(new_element);
			}
		}
		this.set_edited(true);
		this.undo.store();
		this._update_selection();
	}

	, format: function(params){
		if(this.selection.selection && this.selection.selection.type == 'Control'){
			var selection = this.selection.range.item(0);
			this.selection.select_node(selection);
		}else{
			this.focus(); // For IE 8
			var selection = this.store_selection();
		}
		this.focus(); // For IE 8
		this._update_selection(); // For IE 8
		var element = {
			tag_name: params.selector.elements[0].tag_name,
			class_name: params.selector.elements[0].class_name? params.selector.elements[0].class_name: '',
			id: params.selector.elements[0].id,
			attributes: params.attributes
		};
		switch(element.tag_name){
			case 'ul':
				this.document.execCommand('insertunorderedlist', null, null);
				break;
			case 'ol':
				this.document.execCommand('insertorderedlist', null, null);
				break;
			case 'li':
				var selected_nodes = reformator.dom_element.get_common_sibling_nodes(this.selection.get_start_node(), this.selection.get_end_node());
				if(selected_nodes[0] && (!selected_nodes[0].tagName || selected_nodes[0].tagName.toLowerCase() != 'li')){
					selected_nodes = [reformator.dom_element.get_first_ancestor_element(selected_nodes[0], 'li')];
				}
				if(selected_nodes[0]){
					var previous = reformator.dom_element.get_first_previous_sibling_element(selected_nodes[0], 'li');
					if(previous){
						var new_element = this.document.createElement(window.addEventListener? selected_nodes[0].parentNode.tagName: '<' + selected_nodes[0].parentNode.tagName + '>');
						previous.appendChild(new_element);
						for(var i = 0; i < selected_nodes.length; i++){
							new_element.appendChild(selected_nodes[i]);
						}
					}else{
						var parent_element = selected_nodes[0].parentNode;
						var before_element = parent_element.parentNode;
						if(before_element.tagName.toLowerCase() == 'li'){
							before_element.parentNode.appendChild(this.document.createTextNode(''));
							reformator.dom_element.move_children_before(parent_element, before_element.nextSibling);
							parent_element.parentNode.removeChild(parent_element);
						}
					}
				}
				break;
			case 'th':
				var ancestor = this.find_suitable_ancestor_element({selector: reformator.css.parse_selector('tr > *')});
				if(ancestor){
					var new_element = this._replace_element_by_new(ancestor, reformator.html.tags.all[ancestor.tagName].name == 'th'? 'td': 'th');
					this._format_apply_params(new_element, element);
				}
				break;
			default:
				var ancestor = this.find_suitable_ancestor_element({selector: params.selector});
				if(
					ancestor
					&& (
						this.selection.collapsed()
						|| this.selection.get_type() == 'element'
					)
				){
					ancestor_tag = reformator.html.tags.all[ancestor.tagName];
					if(
						element.tag_name
						&& ancestor_tag
						&& ancestor_tag.name == element.tag_name
						&& (
							!element.class_name
							|| (
								ancestor.className.match(new RegExp('^\\s*' + element.class_name + '\\s*$'))
								&& element.tag_name != 'table'
							)
						)
						&& params.remove != false
					){
						this._replace_element_by_null(ancestor);
					}else{
						this._format_apply_params(ancestor, element);
					}
				}else{
					if(params.selector.elements[params.selector.elements.length - 1].tag_name == 'table'){
						var new_elements = this._format_table(element);
					}else{
						var tag = reformator.html.tags.all[element.tag_name], new_elements;
						new_elements = element.tag_name && tag && tag.block && !tag.empty ? this._format_block(element) : this._format_inline(element);
					}
					if(new_elements && new_elements.length){
						for(var i = 0; i < new_elements.length; i++){
							this._format_apply_params(new_elements[i], element);
						}
					}
				}
		}
		this.set_edited(true);
		this.restore_selection(selection);
		this.undo.store();
		this._update_selection();
	}

	, find_suitable_ancestor_element: function(params){
		var selectors = params.selector.elements;
		var result = null, i, ii, iii, iv, ancestor_tag;
		for(i = 0; i < this.ancestors.length; i++){
		//for(i = this.ancestors.length - 1, tag; i >= 0; i--){
			ancestor_tag = reformator.html.tags.all[this.ancestors[i].tagName];
			if(
				!selectors[0].tag_name
				|| (ancestor_tag && ancestor_tag.name == selectors[0].tag_name)
			){
				result = this.ancestors[i];
			}
			if(
				selectors[0].class_name
			){
				//if(
				//	result
				//	&& !reformator.dom_element.has_class(result, selectors[0].class_name)
				//	&& selectors[0].tag_name
				//	&& !ancestor_tag.inline
				//){
				//	result = null;
				//}
				for(ii = i; ii < this.ancestors.length; ii++){
					if(reformator.dom_element.has_class(this.ancestors[ii], selectors[0].class_name)){
						result = this.ancestors[ii];
						break;
					}
				}
			}
			if(result){
				iv = i + 1;
				for(ii = 1, iii = 1; ii < selectors.length; ii++){
					while(this.ancestors[iv]){
						ancestor_tag = reformator.html.tags.all[this.ancestors[iv].tagName];
						if(
							(
								!selectors[ii].tag_name
								|| (ancestor_tag && ancestor_tag.name == selectors[ii].tag_name)
							) && (
								!selectors[ii].class_name
								|| reformator.dom_element.has_class(this.ancestors[iv], selectors[ii].class_name)
							)
						){
							iii++;
							break;
						}else if(selectors[ii - 1].next_ancestor_must_be_parent){
							break;
						}
						iv++;
					}
				}
				if(iii == selectors.length){
					break;
				}else{
					result = null;
				}
			}
		}
		return result;
	}

	, match_with_ancestors: function(params){
		var t = this;
		var selectors = params.selector.elements;
		for(var i = 0, j = 0, jj = 1, ancestor, tag; i < this.ancestors.length && j < selectors.length; i++){
			ancestor = this.ancestors[i];
			tag = reformator.html.tags.all[ancestor.tagName];
			if(tag){
				if(eq(ancestor, selectors[j], tag)){
					j++;
				}
				if(eq(ancestor, selectors[jj], tag)){
					jj++;
				}
				if(selectors[j] && selectors[j].valid && !selectors[j].valid(t)){
					j = 0;
					jj = 1;
				}
			}
		}
		return {
			disabled: selectors.length != j && selectors.length != jj,
			active: selectors.length == j
		};

		function eq(ancestor, element, tag){
			return element
				&& (
					!element.tag_name
					|| tag.name.match(element.tag_name_pattern)
				) && (
					!element.class_name
					|| reformator.dom_element.has_class(ancestor, element.class_name)
				) && (
					!element.attributes
					|| ancestor.getAttribute(element.attributes[0].name)
			);
		};
	}

	, _format_table: function(params){
		if(params.tag_name == 'table'){
			var new_elements = this._format_block({tag_name: 'div'});
			if(new_elements && new_elements.length){
				var table = this.document.createElement('table');
				table.appendChild(this.document.createElement('caption'));
				var tbody = this.document.createElement('tbody');
				table.appendChild(tbody);
				new_elements[0].parentNode.insertBefore(table, new_elements[0]);
				for(var i = 0, tr, td; i < new_elements.length; i++){
					tr = this.document.createElement('tr');
					td = this.document.createElement('td');
					tr.appendChild(td);
					td.appendChild(new_elements[i]);
					reformator.dom_element.replace_by_null(new_elements[i]);
					tbody.appendChild(tr);
				}
				if(!table.nextSibling){
					table.parentNode.appendChild(this.document.createElement('br'));
				}
				return [table];
			}
		}else if(reformator.dom_table.prototype[params.tag_name]){
			var table = new reformator.dom_table({
				element: this.ancestors[0]
				, document: this.document
				, selection: this.selection
			});
			if(table.cells && table[params.tag_name]){
				table[params.tag_name]();
				this._format_clear_child(table.current.element);
			}
		}
	}

	, _format_block: function(params){
		var selected_nodes = reformator.dom_element.get_common_sibling_nodes(this.selection.get_start_node(), this.selection.get_end_node());
		if(selected_nodes){
			var tag = reformator.html.tags.all[params.tag_name];
			if(tag.inline_only){
				for(var i = 0, selected_tag; i < selected_nodes.length; i++){
					if(selected_nodes[i].tagName){
						selected_tag = reformator.html.tags.all[selected_nodes[i].tagName];
						if(selected_tag && selected_tag.block && !selected_tag.inline){
							return null;
						}
					}
				}
			}

			var first_selected_node = selected_nodes[0], parent_first_selected_node = first_selected_node.parentNode;
			if(
				first_selected_node.id.indexOf('reformator_selection_') > -1
				&& parent_first_selected_node
				&& parent_first_selected_node.tagName
				&& reformator.html.tags.all[parent_first_selected_node.tagName]
				&& reformator.html.tags.all[parent_first_selected_node.tagName].children
			){
				// Fix bug in FF with selected table cell
				first_selected_node = first_selected_node.parentNode;
			}

			while(
				first_selected_node.tagName
				&& reformator.html.tags.all[first_selected_node.tagName]
				&& reformator.html.tags.all[first_selected_node.tagName].parents
			){
				first_selected_node = first_selected_node.parentNode;
				selected_nodes = [first_selected_node];
			}

			var parent_tag = reformator.html.tags.all[selected_nodes[0].parentNode.tagName];
			while(
				selected_nodes[0].parentNode
				&& selected_nodes[0].parentNode == selected_nodes[selected_nodes.length - 1].parentNode
				&& selected_nodes[0].parentNode.tagName
				&& (parent_tag = reformator.html.tags.all[selected_nodes[0].parentNode.tagName])
				&& (
					!parent_tag.block || (
						parent_tag.inline_only
						&& !tag.inline_only
					)
				)
			){
				selected_nodes = [selected_nodes[0].parentNode];
			}

			var sibling_node = selected_nodes[0];
			selected_nodes.reverse();
			function add_inline_sibling(direction){
				var i = 0;
				while(
					sibling_node
					&& (
						!sibling_node.tagName
						|| !reformator.html.tags.all[sibling_node.tagName]
						|| reformator.html.tags.all[sibling_node.tagName].inline
					)
				){
					if(i){
						selected_nodes[selected_nodes.length] = sibling_node;
					}
					sibling_node = sibling_node[direction + 'Sibling'];
					i++;
				}
			};
			add_inline_sibling('previous');
			selected_nodes.reverse();
			sibling_node = selected_nodes[selected_nodes.length - 1];
			add_inline_sibling('next');

			var new_element = this.document.createElement(window.addEventListener? params.tag_name: '<' + params.tag_name + '>');
			selected_nodes[0].parentNode.insertBefore(new_element, selected_nodes[0]);

			try{
				for(var i = 0; i < selected_nodes.length; i++){
					new_element.appendChild(selected_nodes[i]);
				}
			}catch(e){};

			parent_tag = reformator.html.tags.all[new_element.parentNode.tagName];
			if(parent_tag && parent_tag.inline_only){
				this._replace_element_by_null(new_element.parentNode);
			}

			return [new_element];
		}else{
			return null;
		}
	}

	, _format_inline: function(params){
		if(
			this.selection.collapsed()
			&& params.tag_name
			&& reformator.html.tags.all[params.tag_name]
			&& reformator.html.tags.all[params.tag_name].empty
		){
			this.insert('<' + params.tag_name + ' id="reformator_temp"/>');
			var temp_element = this.document.getElementById('reformator_temp');
			if(temp_element){
				temp_element.id = '';
			}
			return [temp_element];
		}
		this.document.execCommand('fontname', null, 'reformator_temp');
		var temp_elements = get_temp_elements(this.document.body);
		if(temp_elements && temp_elements.length){
			var new_elements = [];
			for(var i = 0, element, new_element, tag; i < temp_elements.length; i++){
				element = temp_elements[i];
				new_elements[new_elements.length] = new_element = this.document.createElement(params.tag_name? params.tag_name: 'span');
				tag = reformator.html.tags.all[element.tagName];
				if(
					tag
					&& tag.name != 'span'
					&& tag.name != 'font'
					&& tag.name != params.tag_name
					&& element.id.indexOf('reformator_selection_') != 0
				){
					element.style.fontFamily = '';
					if(tag.empty){
						element.parentNode.insertBefore(new_element, element);
						new_element.appendChild(element);
					}else{
						reformator.dom_element.move_children(element, new_element);
						element.appendChild(new_element);
					}
				}else if(element.parentNode && element.id.indexOf('reformator_selection_') != 0){
					reformator.dom_element.replace_by(element, new_element);
				}
			}

			this._format_join_equal_sibling(new_elements, params);
			this._format_join_equal_sibling(new_elements, params); // For FF -- problem with nobr

			if(new_elements[0]){
				this.selection.select_node(new_elements[0]);
			}
			return new_elements;
		}else{
			return null;
		}

		function get_temp_elements(element){
			for(var i = 0, child_node; i < element.childNodes.length; i++){
				child_node = element.childNodes[i];
				if(child_node && child_node.nodeType == 1){
					if(child_node.style.fontFamily == 'reformator_temp' || child_node.face == 'reformator_temp'){
						if(!temp_elements){
							var temp_elements = [];
						}
						//if(child_node.parentNode.tagName.toLowerCase() == 'body' && child_node.innerHTML.match(/^\s*$/)){
						//	for Opera
						//	this._replace_element_by_null(child_node);
						//}else{
							temp_elements[temp_elements.length] = child_node;
						//}
					}else{
						var temp_elements_inner = get_temp_elements(child_node);
						if(temp_elements_inner){
							if(temp_elements){
								for(var ii = 0; ii < temp_elements_inner.length; ii++){
									temp_elements[temp_elements.length] = temp_elements_inner[ii];
								}
							}else{
								temp_elements = temp_elements_inner;
							}
						}
					}
				}
			}
			return temp_elements;
		};
	}

	, _format_join_equal_sibling: function(elements, params){
		for(var i = 0, ii = elements.length, element, parent_element, parent_tag, sibling; i < ii; i++){
			element = elements[i];
			parent_element = element.parentNode;
			if(parent_element){ // For FF -- problem with nobr
				parent_tag = reformator.html.tags.all[parent_element.tagName];
				if(
					parent_tag &&
					!parent_tag.block &&
					ii > 1 &&
					reformator.html.remove_tags(parent_element.innerHTML) ==
						reformator.html.remove_tags(element.innerHTML)
				){
					parent_element.parentNode.insertBefore(element, parent_element);
					reformator.dom_element.move_children(element, parent_element);
					element.appendChild(parent_element);
				}
			}
			if(element){
				sibling = element.previousSibling;
				while(
					sibling
					&& (
						(!sibling.tagName && !sibling.nodeValue)
						|| (sibling.id && sibling.id.indexOf('reformator_selection_') == 0)
					)
				){
					sibling = sibling.previousSibling;
				}
				if(
					sibling
					&& sibling.nodeType == 1
				){
					if(this._format_match_params(sibling, params)){
						reformator.dom_element.move_children_before(sibling, element.firstChild);
						sibling.parentNode.removeChild(sibling);
					}else{
						if(recursive_replace_element_by_null(sibling, params)){
							element.insertBefore(sibling, element.firstChild);
						}
					}
				}
				sibling = element.nextSibling;
				while(
					sibling
					&& (
						(!sibling.tagName && !sibling.nodeValue)
						|| (sibling.id && sibling.id.indexOf('reformator_selection_') == 0)
					)
				){
					sibling = sibling.nextSibling;
				}
				if(
					sibling
					&& sibling.nodeType == 1
				){
					if(this._format_match_params(sibling, params)){
						reformator.dom_element.move_children(sibling, element);
						sibling.parentNode.removeChild(sibling);
					}else{
						if(recursive_replace_element_by_null(sibling, params)){
							element.appendChild(sibling);
						}
					}
				}
			}
		}

		var t = this;
		function recursive_replace_element_by_null(element, params){
			for(var i = 0, child_node, removed = false; i < element.childNodes.length; i++){
				child_node = element.childNodes[i];
				if(child_node && child_node.nodeType == 1){
					if(recursive_replace_element_by_null(child_node, params)){
						removed = true;
					}
					if(t && t._format_match_params(child_node, params)){
						t._replace_element_by_null(child_node);
						removed = true;
					}
				}
			}
			return removed;
		};
	}

	, _format_match_params: function(element, params){
		return element.tagName.toLowerCase() == params.tag_name && (!params.class_name || reformator.dom_element.has_class(element, params.class_name));
	}

	, _format_apply_params: function(element, params){
		if(params.class_name){
			if(reformator.dom_element.has_class(element, params.class_name)){
				reformator.dom_element.remove_class(element, params.class_name);
			}else{
				reformator.dom_element.add_class(element, params.class_name);
			}
		}else{
			element.className = '';
		}
		if(params.attributes){
			if(!reformator.js.is_array(params.attributes)){
				params.attributes = [params.attributes];
			}
			for(var i = 0; i < params.attributes.length; i++){
				element.setAttribute(params.attributes[i].name, params.attributes[i].value);
			}
		}
	}

	, _format_clear: function(){
		this._format_clear_child(this.document.body);
		if(!this.document.body.childNodes.length){
			this.set_empty();
			this.set_edited(true);
		}
	}

	, _format_clear_child: function(element, inline_only){
		var last_child;
		tag = reformator.html.tags.all[element.tagName];
		if(tag && tag.block){
			while(
				element.childNodes.length > 1
				&& (last_child = element.childNodes[element.childNodes.length - 1])
				&& (
					(
						last_child.nodeType == 3
						&& last_child.nodeValue.match(/^\s*$/)
					) || (
						last_child.nodeType == 1
						&& last_child.tagName.toLowerCase() == 'br'
						&& !tag.can_be_empty
					)
				)
			){
				last_child.parentNode.removeChild(last_child);
				this.set_edited(true);
			}
		}
		var children = element.childNodes, child_node, removed, tag, result = {}, class_name, class_names, o, attributes;
		for(var i = 0, ii, inner_result, tags = 0; i < children.length; i++){
			child_node = children[i];
			removed = false;
			if(child_node.nodeType == 1){
				tags++;
				tag = reformator.html.tags.all[child_node.tagName];
				if(tag && tag.remove_with_content && !reformator.elements_by_tag_name[tag.name]){
					child_node.parentNode.removeChild(child_node);
					removed = true;
					i--;
					tags--;
					this.set_edited(true);
				}else{
					inner_result = this._format_clear_child(child_node);
					if(inner_result.block){
						result.block = true;
						if(tag && tag.inline_only){
							this._replace_element_by_null(child_node);
							removed = true;
							i--;
							tags--;
							this.set_edited(true);
						}
					}
					if(
						!tag
						|| (
							tag.remove
							&& !reformator.elements_by_tag_name[tag.name]
						)
					){
						this._replace_element_by_null(child_node, tag ? tag.inline_only : null);
						removed = true;
						i--;
						tags--;
						this.set_edited(true);
					}else if(
						inner_result.empty
						&& !tag.empty
						&& !tag.can_be_empty
						&& !reformator.dom_element.has_class(child_node, 'nbsp')
					){
						this._replace_element_by_null(child_node);
						removed = true;
						i--;
						tags--;
						this.set_edited(true);
					}else if(tag.block && !tag.inline){
						if(this.inline_only || inline_only){
							child_node.appendChild(this.document.createTextNode(' '));
							this._replace_element_by_null(child_node);
							removed = true;
							i--;
							tags--;
							this.set_edited(true);
						}else{
							result.block = true;
						}
					}else if(inner_result.block){
						this._replace_element_by_null(child_node);
						removed = true;
						i--;
						tags--;
						this.set_edited(true);
					}
					if(!removed){
						if(child_node.className){
							class_names = child_node.className.split(/\s+/);
							class_name = '';
							for(ii = 0; ii < class_names.length; ii++){
								o = reformator.elements_by_class_name[class_names[ii]];
								if(
									o
									&& (
										!o.tag_name
										|| o.tag_name == tag.name
									)
								){
									class_name += (class_name? ' ': '') + class_names[ii];
								}
							}
							if(child_node.className != class_name){
								child_node.className = class_name;
								this.set_edited(true);
							}
						}
						if(!child_node.className && tag.remove_without_class){
							this._replace_element_by_null(child_node);
							removed = true;
							i--;
							tags--;
							this.set_edited(true);
						}
					}
					if(!removed){
						if(tag.replace_with && !reformator.elements_by_tag_name[tag.name]){
							this._replace_element_by_new(child_node, tag.replace_with);
							this.set_edited(true);
						}else{
							child_node.style.cssText = '';
							attributes = child_node.attributes;
							for(ii = 0; ii < attributes.length; ii++){
								if(
									!tag.attributes[attributes[ii].nodeName.toLowerCase()]
									&& attributes[ii].nodeValue
									&& attributes[ii].nodeValue.indexOf('reformator_') < 0
								){
									child_node.removeAttributeNode(attributes[ii]);
									this.set_edited(true);
								}
							}
						}
					}
				}
			}else{
				if(child_node.nodeValue && child_node.nodeValue.match(this.nbsp_patterns)){
					child_node.nodeValue = child_node.nodeValue.replace(this.nbsp_patterns, reformator.html.entities.common.nbsp[0]);
				}
			}
		}
		if(!children.length || (!tags && element.innerHTML.match(this.empty_pattern))){
			result.empty = true;
		}
		return result;
	}

	, _cancel_submit: function(document_forms){
		// For Chrome
		for(var i = 0; i < document_forms.length; i++){
			reformator.dom_element.add_event_listener(document_forms[i], 'submit', function(event){
				return reformator.dom_element.cancel_event(event);
			});
		}
	}

	, _replace_element_by_null: function(old_element){
		var tag = reformator.html.tags.all[old_element.tagName];
		if(tag && tag.children){
			for(var i = old_element.childNodes.length - 1, child_node, child_tag; i >= 0; i--){
				child_node = old_element.childNodes[i];
				if(child_node.tagName){
					child_tag = reformator.html.tags.all[child_node.tagName];
					if(
						child_tag
						&& tag.children[child_tag.name]
					){
						this._replace_element_by_null(child_node);
					}
				}
			}
		}
		if(tag && (tag.name == 'caption' || tag.name == 'tr') && old_element.innerHTML){
			var new_element = this.document.createElement('div');
			reformator.dom_element.replace_by(old_element, new_element);
		}else if(tag && (tag.name == 'td' || tag.name == 'th')){
			if(old_element.nextSibling){
				old_element.parentNode.insertBefore(this.document.createTextNode(' '), old_element.nextSibling);
			}
			reformator.dom_element.replace_by_null(old_element);
		}else{
			reformator.dom_element.replace_by_null(old_element);
		}
	}

	, _replace_element_by_new: function(element, tag_name, class_name){
		var old_tag = reformator.html.tags.all[element.tagName]
			, new_tag = reformator.html.tags.all[tag_name]
			, new_element = this.document.createElement(tag_name)
			, attribute_value;
		for(var s in new_tag.attributes){
			if(new_tag.attributes.constructor.prototype[s]) continue;
			attribute_value = element.getAttribute(s);
			if(attribute_value){
				new_element.setAttribute(s, attribute_value);
			}
		}
		new_element.className = element.className;
		if(class_name){
			reformator.dom_element.add_class(new_element, class_name);
		}
		reformator.dom_element.replace_by(element, new_element);
		return new_element;
	}

	, set_empty: function(){
		try{// For FF 2
			if(!this.inline_only){
				this.document.body.innerHTML = '<p><br/></p>';
				this.selection.select_node(this.document.body.firstChild.firstChild);
			}else{
				this.document.body.innerHTML = ' <br/>';
			}
		}catch(e){};
	}

	, set_edited: function(edited){
		this.edited = edited;
		if(edited){
			this.editor.on_wysiwyg_change();
		}
	}

	, store_selection: function(){
		return this.selection.store();
	}

	, restore_selection: function(selection){
		this.selection.restore(selection);
		this._update_selection();
	}

	, _update_selection: function(){
		//!this.selection.refresh();
		this.parent_element = this.selection.get_parent_element();
		this.ancestors = reformator.dom_element.get_ancestors_elements(this.parent_element, true);
		this.ancestors_path = '';
		for(var i = this.ancestors.length - 1; i >= 0; i--){
			this.ancestors_path += this.ancestors[i].tagName + (this.ancestors[i].className? '.' + this.ancestors[i].className.replace(/\s+/g, '.'): '') + (i? ' > ': '');
		}
		window.status = this.ancestors_path;
		reformator.control.refresh();
	}
};


reformator.wysiwyg_undo = function(wysiwyg){
	this.wysiwyg = wysiwyg;
	this.selection = wysiwyg.selection;
	this.window = wysiwyg.window;
	this.document = this.window.document;
	try{// For FF 2
		var content = this.document.body.innerHTML;
		this.states = [{content: content, normalized_content: content}, {content: content, normalized_content: content}];
		this.position = 0;
	}catch(e){
		var content = '';
		this.states = [];
		this.position = -1;
	};
	this.clear_as();
};

reformator.wysiwyg_undo.prototype = {
	backward: function(){
		if(this.position > 0){
			this.position -= 2;
			this.restore(true);
		}
	},

	forward: function(){
		if(this.states[this.position + 2]){
			this.position += 2;
			this.restore();
		}
	},

	store: function(params){
		var position = this.position;
		if(!params){
			params = {};
		}
		var selection = this.selection.store();
		var content = this.document.body.innerHTML;
		var normalized_content = content.replace(/<([A-Za-z]+)[^>]+reformator_selection_[01][^>]*>(<\/\1>)?/g, '');
		if(this.position < 0){
			this.position = 0;
			this.states[this.position] = {selection: selection, content: content};
			this.states[this.position + 1] = {selection: selection, content: content, normalized_content: normalized_content};
			//document.title += ' N:' + this.position
		}else{
			var position = this.position;
			if(!params.as_selection){
				if(params.as_remove){
					if(!this.as_remove){
						this.as_sequence = false;
						this.as_remove = true;
					}
				}else if(this.as_remove){
					this.clear_as();
				}
				if(params.as_sequence){
					if(!this.as_sequence){
						this.position += 2;
					}
					this.as_sequence = true;
				}else{
					this.position += 2;
					this.clear_as();
				}
				if(position != this.position && this.states[this.position - 2].normalized_content == normalized_content){
					this.clear_as();
					this.position -= 2;
					//document.title += ' C:' + this.position
				}else{
					this.states[this.position] = {selection: selection, content: content, normalized_content: normalized_content};
					this.states[this.position + 2] = null;
					this.states[this.position + 3] = null;
					//document.title += ' S:' + this.position
				}
			}else{
				this.clear_as();
			}
			this.states[this.position + 1] = {
				selection: selection,
				content: content,
				normalized_content: normalized_content
			};
		}
	},

	restore: function(undo){
		var undo_offset = undo ? 1: 0;
		this.document.body.innerHTML = this.states[this.position + undo_offset].content;
		this.selection.restore(this.states[this.position + undo_offset].selection);
		this.clear_as();
		//document.title += ' ' + (undo_offset? 'U:' : 'R:') + this.position
	},

	clear_as: function(){
		this.as_sequence = false;
		this.as_remove = false;
	}
};


reformator.bar = {
	create: function(){
		reformator.dom_element.add_class(document.body.parentNode, 'with_reformator_bar');
		this.created = true;
		this.element = document.createElement('div');
		this.element.id = 'reformator_bar';
		this.element.innerHTML = '<iframe frameborder="no"></iframe>';
		var t = this;
		setTimeout(function(){ // For IE 6 
			document.body.appendChild(t.element);
			t.element.firstChild.src = reformator.bar_path;
			if(!document.cookie || document.cookie.indexOf('reformator_bar=hidden') < 0){
				t.set_active(true);
			}
		}, 0);
	}

	, set_active: function(actived){
		this.actived = actived;
		if(!this.actived){
			document.cookie = 'reformator_bar=hidden';
		}else{
			document.cookie = 'reformator_bar=visible';
		}
		reformator.dom_element.replace_class(document.body.parentNode, 'reformator_bar_visible', '', this.actived);
		document.body.className += ''; // For IE 6
	}

};


reformator.control = {
	auto: function(params){
		this.init(params);
		var elements = this.element.getElementsByTagName('a');
		for(var i = 0, command; i < elements.length; i++){
			command = unescape(elements[i].getAttribute('href')).match(/^[^#]*#([^\s]+)\s*(.*)?/);
			if(command){
				this.append({
					element: elements[i]
					, action: command[1]
					, option: command[2]
					
				});
			}
		}
	}

	, init: function(params){
		this.element = params && params.element? params.element: document.body;
	}

	, children: []

	, append: function(params){
		this.children[this.children.length] = new reformator.control.object(params);
	}

	, refresh: function(){
		var t = this;
		if(
			!reformator.current
			|| !reformator.current.focused
		){
			for(var i = 0; i < t.children.length; i++){
				t.children[i].set_disabled(true);
			}
		}else{
			for(var i = 0; i < t.children.length; i++){
				t.children[i].set_disabled(false);
				t.children[i].update();
			}
		}
	}
};

reformator.control.object = function(params){
	this.element = params.element;
	this.cancel_event(this.element.parentNode);
	if(params.action && reformator.control.actions[params.action]){
		for(var s in reformator.control.actions[params.action]){
			if(reformator.control.actions[params.action].constructor.prototype[s]) continue;
			this[s] = reformator.control.actions[params.action][s];
		}
		this.init(params.option);
		var t = this;
		reformator.dom_element.add_event_listener(
			this.element
			, 'mousedown'
			, function(event){
				if(t.disabled){
					return reformator.dom_element.cancel_event(event);
				}else{
					t.clicked = true;
				}
			}
		);
		reformator.dom_element.add_event_listener(
			this.element
			, 'click'
			, function(event){
				if(!t.disabled || t.clicked){
					t.exec();
					if(reformator.current){
						reformator.current.focus();
					}
					t.update();
				}
				t.clicked = false;
				reformator.control.refresh();
				return reformator.dom_element.cancel_event(event);
			}
		);
	}
	this.set_disabled(true);
};

reformator.control.object.prototype = {
	set_disabled: function(disabled){
		this.disabled = disabled && !this.clicked;
		//this.element.parentNode.disabled = this.disabled;
		reformator.dom_element.replace_class(this.element.parentNode, 'disabled', '', this.disabled);
		this.set_active(!this.disabled);
	}

	, set_active: function(actived){
		this.actived = actived;
		reformator.dom_element.replace_class(this.element, 'active', '', this.actived);
	}

	, update: function(){
		this.set_disabled(false);
	}

	, init: function(params){}

	, exec: function(){}

	, cancel_event: function(element){
		if(element && element.unselectable != 'on' && element != this.element){
			element.unselectable = 'on';
			reformator.dom_element.add_event_listener(element, 'mousedown', function(event){
				//Bug in IE with scrollbar by control_class
				//if(reformator.current){
				//	reformator.current.focus();
				//}
				reformator.dom_element.cancel_event(event);
			});
			if(element != reformator.control.element){
				this.cancel_event(element.parentNode);
			}
		}
	}
};

reformator.control.actions = {
	source: {
		exec: function(){
			reformator.current.set_active(!reformator.current.actived);
		}

		, update: function(){
			this.set_active(!reformator.current.actived);
		}
	}

	, bar: {
		init: function(){
			this.update();
		}

		, exec: function(){
			reformator.bar.set_active(!reformator.bar.actived);
		}

		, update: function(){
			this.set_active(reformator.bar.actived);
		}

		, set_disabled: function(disabled){}
	}

	, maximize: {
		exec: function(){
			reformator.current.set_maximize(!reformator.current.maximize);
		}

		, update: function(){
			this.set_active(reformator.current.maximize);
		}
	}

	, autoformat: {
		exec: function(){
			reformator.current.set_autoformat(!reformator.current.autoformat);
		}

		, update: function(){
			this.set_active(reformator.current.autoformat);
		}
	}

	, typograph: {
		exec: function(){
			reformator.current.typograph();
		}

		, set_active: function(actived){}
	}

	, autoclear: {
		exec: function(){
			reformator.current.set_autoclear(!reformator.current.autoclear);
		}

		, update: function(){
			this.set_active(reformator.current.autoclear);
		}
	}

	, clear: {
		exec: function(){
			reformator.current.clear();
		}

		, set_active: function(actived){}
	}

	, undo: {
		set_active: function(actived){}

		, update: function(){
			this.set_disabled(!reformator.current.actived || reformator.current.wysiwyg.undo.position <= 0);
		}

		, exec: function(){
			reformator.current.wysiwyg.undo.backward();
		}
	}

	, redo: {
		set_active: function(actived){}

		, update: function(){
			this.set_disabled(!reformator.current.actived || !reformator.current.wysiwyg.undo.states[reformator.current.wysiwyg.undo.position + 2]);
		}

		, exec: function(){
			reformator.current.wysiwyg.undo.forward();
		}
	}

	, insert: {
		init: function(html){
			if(this.element.onclick){
				this.func = this.element.onclick;
				if(!html){
					this.block = true;
				}
				this.element.onclick = null;
			}
			if(html){
				var t = this;
				html.replace(/<(\w+)[^<>]*>/g, function(str, s1){
					if(reformator.html.tags.all[s1] && reformator.html.tags.all[s1].block && !reformator.html.tags.all[s1].inline){
						t.block = true;
					}
				});
				this.html = html;
			}
		}

		, update: function(){
			if(!reformator.current.actived){
				this.set_disabled(true);
			}else{
				if(reformator.current.inline_only && this.block){
					this.set_disabled(true);
				}else{
					this.set_disabled(false);
				}
			}
		}

		, exec: function(){
			if(this.func){
				var func_result = this.func();
				if(func_result){
					if(typeof(func_result) == 'object'){
						reformator.current.wysiwyg.insert(func_result[0], func_result[1], func_result[2], this.block);
					}else{
						reformator.current.wysiwyg.insert(func_result, null, null, this.block);
					}
				}
			}else if(this.html){
				reformator.current.wysiwyg.insert(this.html, null, null, this.block);
			}
		}

		, set_active: function(actived){}
	}

	, format: {
		init: function(selector_string){
			this.selector = reformator.css.parse_selector(selector_string);
		}

		, update: function(){
			if(!reformator.current.actived){
				this.set_disabled(true);
			}else{
				var match_with_ancestors = reformator.current.wysiwyg.match_with_ancestors({selector: this.selector});
				if(reformator.current.inline_only && this.selector.block){
					this.set_disabled(true);
				}else{
					this.set_disabled(match_with_ancestors.disabled);
				}
				this.set_active(match_with_ancestors.active && (reformator.current.wysiwyg.selection.collapsed() || reformator.current.wysiwyg.selection.get_type() == 'element'));
			}
		}

		, exec: function(){
			if(this.selector.attributes){
				// multiple attributes later
				this.exec_with_prompt_attribute(this.selector.attributes[0].name);
			}else if(this.selector.tag_name == 'a'){
				this.exec_with_prompt_attribute('href');
			}else if(this.selector.tag_name == 'img'){
				this.exec_with_prompt_attribute('src');
			}else{
				reformator.current.wysiwyg.format({
					selector: this.selector
				});
			}
		}

		, exec_with_prompt_attribute: function(attribute_name){
			var
				ancestor = reformator.current.wysiwyg.find_suitable_ancestor_element({selector: this.selector}),
				attribute_value = ancestor? ancestor.getAttribute(attribute_name): ''
			;
			if(this.selector.class_name && ancestor){
				reformator.current.wysiwyg.format({
					selector: this.selector
					, remove: false
				});
			}else{
				attribute_value = prompt(this.element.title, attribute_value);
				if(attribute_value != null){
					if((attribute_name == 'href' || attribute_name == 'src') && attribute_value && !attribute_value.match(/^([a-z]+\:|\/)/)){
						attribute_value = (attribute_value.match(/^(?:[-a-z\d\+\*\/\?!{}`~_%&'=^$#]+(?:\.[-a-z\d\+\*\/\?!{}`~_%&'=^$#]+)*)@(?:[-a-z\d_]+\.){1,60}[a-z]{2,6}$/)? 'mailto:': 'http:\/\/') + attribute_value;
					}
					if(!(!attribute_value && !ancestor)){
						reformator.current.wysiwyg.format({
							selector: this.selector
							, attributes: [{name: attribute_name, value: attribute_value}]
							, remove: !attribute_value
						});
					}
				}
			}
		}
	}
};


reformator.css = {
	parse_selector: function(selector_string){
		return this.children[selector_string]? this.children[selector_string]: this.children[selector_string] = new this.selector(selector_string);
	}

	, children: []

	, selector: function(selector_string){
		this.elements = [];
		var t = this, i;
		if(selector_string){
			selector_string = selector_string.replace(/list\s+indent/, 'li li'); // for backward compatibility
			selector_string = selector_string.replace(/(^\s+|\s+$)/g, '');
			selector_string = selector_string.replace(/(\s*\>\s*|\s*\+\s*|\s+)?([a-zA-Z0-9\.\#\-\_\:\[\]\=\~\"\'\|\*]+)/g,
				function(s, element_separator, tag_name){
					if(tag_name){
						i = t.elements.length;
						element = {};
						if(element_separator && element_separator.indexOf('>') > -1){
							element.next_ancestor_must_be_parent = true;
						}else if(element_separator && element_separator.indexOf('+') > -1){
							element.immediately_preceding = t.elements[i - 1];
							i--;
						}else if(element_separator && element_separator.indexOf('~') > -1){
							element.preceding = t.elements[i - 1];
							i--;
						}
						tag_name = tag_name.replace(/\[([^\]]*)\]/g, function(s, attribute){
							if(attribute){
								if(!element.attributes){
									element.attributes = [];
								}
								var temp = attribute.replace(/^([a-zA-Z0-9]+)(?:(.?=)"([^"]*)")?$/,
									function(s1, name, expression, value){
										element.attributes[element.attributes.length] = {name: name, expression: expression, value: value};
										return '';
									}
								);
							}
							return '';
						});
						tag_name = tag_name.replace(/([\.\#\:])([^\.\#\:]+)/g, function(s, pattern_separator, pattern){
							if(pattern_separator == '.'){
								element.class_name = pattern;
							}else if(pattern_separator == '#'){
								element.id = pattern;
							}
							return '';
						});
						if(tag_name != '*'){
							element.tag_name = tag_name;
						}else{
							tag_name = '.' + tag_name;
						}
						if(tag_name){
							element.tag_name_pattern = new RegExp('^' + tag_name + '$');
						}
						t.elements[i] = element;
					}
					return '';
				}
			);
		}
		if(this.elements.length){
			this.elements.reverse();
			this.tag_name = this.elements[0].tag_name;
			this.class_name = this.elements[0].class_name;
			this.attributes = this.elements[0].attributes;
			this.id = this.elements[0].id;
			if(this.class_name){
				reformator.elements_by_class_name[this.class_name] = {tag_name: this.tag_name};
			}
			if(this.tag_name){
				var tag = reformator.html.tags.all[this.tag_name];
				if(tag){
					this.block = tag.block;
				}
				if(
					this.elements[0].tag_name == 'li'
					&& this.elements[1].tag_name == 'li'
				){
					this.elements[0].tag_name_pattern = /^$/;
					this.elements[1].tag_name_pattern = /^[uo]l$/;
				}else{
					reformator.elements_by_tag_name[this.tag_name] = {class_name: this.class_name};
				}
			}
		}
	}
};


reformator.dom_table = function(params){
	if(params.element){
		this.find_cell_and_table(params.element);
	}
	this.document = params.document? params.document: document;
	this.selection = params.selection;
	if(this.table){
		this.init();
	}
};

reformator.dom_table.prototype = {
	append_row_before: function(){
		var new_row = this.document.createElement('tr');
		for(var i = 0, cell, new_cell; i < this.cells[this.current.row].length; i++){
			cell = this.cells[this.current.row][i];
			if(cell.col == i){
				if(cell.row == this.current.row){
					new_cell = this.document.createElement(cell.element.tagName);
					new_cell.appendChild(this.document.createElement('br'));
					if(cell.element.colSpan > 1){
						new_cell.colSpan = cell.element.colSpan;
					}
					new_row.appendChild(new_cell);
				}else{
					cell.element.rowSpan++;
				}
			}
		}
		this.rows[this.current.row].parentNode.insertBefore(new_row, this.rows[this.current.row]);
	}

	, append_row_after: function(){
		var new_row = this.document.createElement('tr'), current_row = this.current.row + this.current.element.rowSpan - 1;
		for(var i = 0, cell, new_cell; i < this.cells[current_row].length; i++){
			cell = this.cells[current_row][i];
			if(cell.col == i){
				if(
					cell.row == current_row
					&& cell.element.rowSpan > 1
				){
					cell.element.rowSpan++;
				}else{
					new_cell = this.document.createElement(cell.element.tagName);
					new_cell.appendChild(this.document.createElement('br'));
					if(cell.element.colSpan > 1){
						new_cell.colSpan = cell.element.colSpan;
					}
					new_row.appendChild(new_cell);
				}
			}
		}
		i = current_row + 1;
		if(this.rows[i]){
			this.rows[i].parentNode.insertBefore(new_row, this.rows[i]);
		}else{
			this.rows[current_row].parentNode.appendChild(new_row);
		}
	}

	, append_column_before: function(){
		var i = 0, cell, new_cell;
		while(this.cells[i]){
			cell = this.cells[i][this.current.col];
			if(cell.col == this.current.col){
				new_cell = this.document.createElement(cell.element.tagName);
				new_cell.rowSpan = cell.element.rowSpan;
				new_cell.appendChild(this.document.createElement('br'));
				cell.element.parentNode.insertBefore(new_cell, cell.element);
			}else{
				cell.element.colSpan++;
			}
			i += cell.element.rowSpan;
		}
	}

	, append_column_after: function(){
		var current_col = this.current.col + this.current.element.colSpan - 1, i = 0, cell, new_cell, bottom;
		while(this.cells[i]){
			cell = this.cells[i][current_col];
			if(cell.col + cell.element.colSpan - 1 > current_col){
				cell.element.colSpan++;
			}else{
				new_cell = this.document.createElement(cell.element.tagName);
				new_cell.rowSpan = cell.element.rowSpan;
				new_cell.appendChild(this.document.createElement('br'));
				next = this.find_right_cell(i, current_col);
				if(next){
					next.parentNode.insertBefore(new_cell, next);
				}else{
					this.rows[i].appendChild(new_cell);
				}
			}
			i += cell.element.rowSpan;
		}
	}

	, join_right: function(){
		var i = this.current.col + 1;
		while(
			this.cells[this.current.row][i]
			&& this.cells[this.current.row][i].col == this.current.col
		){
			i++;
		}
		var sibling = this.cells[this.current.row][i];
		if(
			sibling
			&& this.current.col != sibling.col
			&& this.current.row == sibling.row
			&& this.current.element.rowSpan == sibling.element.rowSpan
		){
			this.current.element.appendChild(this.document.createTextNode(' '));
			reformator.dom_element.move_children(sibling.element, this.current.element);
			this.current.element.colSpan += sibling.element.colSpan;
			sibling.element.parentNode.removeChild(sibling.element);
		}
	}

	, join_bottom: function(){
		var i = this.current.row + 1;
		while(
			this.cells[i]
			&& this.cells[i][this.current.col].row == this.current.row
		){
			i++;
		}
		var sibling = this.cells[i] ? this.cells[i][this.current.col] : null;
		if(
			sibling
			&& this.current.row != sibling.row
			&& this.current.col == sibling.col
			&& this.current.element.colSpan == sibling.element.colSpan
		){
			this.current.element.appendChild(this.document.createTextNode(' '));
			reformator.dom_element.move_children(sibling.element, this.current.element);
			this.current.element.rowSpan += sibling.element.rowSpan;
			sibling.element.parentNode.removeChild(sibling.element);
		}
	}

	, split: function(){
		if(this.current.element.colSpan > 1 || this.current.element.rowSpan > 1){
			for(var i = 0, ii, next, new_cell; i < this.current.element.rowSpan; i++){
				if(this.rows[this.current.row + i]){
					for(ii = !i? 1: 0; ii < this.current.element.colSpan; ii++){
						new_cell = this.document.createElement(this.current.element.tagName);
						new_cell.appendChild(this.document.createElement('br'));
						next = this.find_bottom_cell(this.current.row + i, this.current.col);
						if(next){
							next.parentNode.insertBefore(new_cell, next);
						}else{
							this.rows[this.current.row + i].appendChild(new_cell);
						}
					}
				}
			}
			this.current.element.colSpan = 1;
			this.current.element.rowSpan = 1;
		}
	}

	, remove_row: function(){
		var i = 0, cell, bottom;
		while(this.cells[this.current.row][i]){
			cell = this.cells[this.current.row][i];
			if(!cell.removed){
				if(cell.element.rowSpan > 1){
					if(cell.row == this.current.row){
						if(this.rows[this.current.row + 1]){
							bottom = this.find_bottom_cell(this.current.row + 1, i);
							if(bottom){
								bottom.parentNode.insertBefore(cell.element, bottom);
							}else{
								this.rows[this.current.row + 1].appendChild(cell.element);
							}
						}
						while(cell.element.childNodes[0]){
							cell.element.removeChild(cell.element.childNodes[0]);
						}
						cell.element.appendChild(this.document.createElement('br'));
					}
					if(cell.element.rowSpan > 1){
						cell.element.rowSpan--;
					}
				}else{
					cell.element.parentNode.removeChild(cell.element);
				}
				cell.removed = true;
			}
			i++;
		}
		this.rows[this.current.row].parentNode.removeChild(this.rows[this.current.row]);
		var new_focus_row = this.cells[this.current.row + 1];
		if(!new_focus_row){
			new_focus_row = this.cells[this.current.row - 1];
		}
		if(new_focus_row){
			this.selection.select_node(new_focus_row[this.current.col].element);
			this.selection.collapse(true);
		}
	}

	, remove_column: function(){
		var i = 0, cell, removed;
		while(this.cells[i]){
			cell = this.cells[i][this.current.col];
			if(!cell.removed){
				if(cell.element.colSpan > 1){
					if(cell.col == this.current.col){
						while(cell.element.childNodes[0]){
							cell.element.removeChild(cell.element.childNodes[0]);
							removed = true;
						}
						cell.element.appendChild(this.document.createElement('br'));
					}
					if(cell.element.colSpan > 1){
						cell.element.colSpan--;
					}
				}else{
					cell.element.parentNode.removeChild(cell.element);
					removed = true;
				}
				cell.removed = true;
			}
			i++;
		}
		if(removed){
			var new_focus_cell = this.cells[this.current.row][this.current.col + 1];
			if(!new_focus_cell){
				new_focus_cell = this.cells[this.current.row][this.current.col - 1];
			}
			if(new_focus_cell){
				this.selection.select_node(new_focus_cell.element.firstChild);
				this.selection.collapse(true);
			}
		}
	}

	, find_right_cell: function(row, col){
		var columns = this.cells[row], i = col;
		while(
			columns[i]
			&& (
				columns[i].col <= col
				|| columns[i].row != row
			)
		){
			i++;
		}
		return columns[i] && columns[i].col > col && columns[i].row == row? columns[i].element: null;
	}

	, find_bottom_cell: function(row, col){
		var columns = this.cells[row], i = col;
		while(
			columns[i]
			&& (
				columns[i].col == col
				|| columns[i].row != row
			)
		){
			i++;
		}
		return columns[i] && columns[i].col != col && columns[i].row == row? columns[i].element: null;
	}

	, init: function(){
		this.row_index = -1;
		this.col_index = -1;
		this.cells = [];
		this.rows = [];
		this.init_by_parent(this.table);
	}

	, init_by_parent: function(parent_element){
		for(var i = 0, ii, iii, cell, child_node, tag; i < parent_element.childNodes.length; i++){
			child_node = parent_element.childNodes[i];
			if(child_node.tagName){
				tag = reformator.html.tags.all[child_node.tagName];
				if(tag.name == 'td' || tag.name == 'th'){
					if(this.col_index < 0){
						this.row_index++;
						this.rows[this.row_index] = child_node.parentNode;
					}
					this.col_index++;
					if(!this.cells[this.row_index]){
						this.cells[this.row_index] = [];
					}
					while(this.cells[this.row_index][this.col_index]){
						this.col_index++;
					}
					cell = {
						element: child_node
						, col: this.col_index
						, row: this.row_index
					};
					if(child_node == this.cell){
						cell.current = true;
						this.current = cell;
					}
					for(ii = 0; ii < child_node.colSpan; ii++){
						this.cells[this.row_index][this.col_index + ii] = cell;
						for(iii = 1; iii < child_node.rowSpan; iii++){
							if(!this.cells[this.row_index + iii]){
								this.cells[this.row_index + iii] = [];
							}
							this.cells[this.row_index + iii][this.col_index + ii] = cell;
						}
					}
					this.col_index += child_node.colSpan - 1;
				}else{
					if(tag.name == 'tr'){
						this.col_index = -1;
					}
					this.init_by_parent(child_node);
				}
			}
		}
	}

	, find_cell_and_table: function(element){
		while(element && element.tagName && !this.cell){
			if(element.tagName.toLowerCase().match(/^t[dh]$/)){
				this.cell = element;
				break;
			}
			element = element.parentNode;
		}
		while(element && element.tagName && !this.table){
			if(element.tagName.toLowerCase() == 'table'){
				this.table = element;
			}
			element = element.parentNode;
		}
	}
};


reformator.dom_element = {
	patterns: []

	, init: function(){
		this.root_path = top.location.href.replace(/^\w+:\/+[^\/]*\x2f/, '').replace(/\/[^\/]*$/, '');
		this.root_path = this.root_path.split('/');
	}

	, replace_class: function(element, old_class, new_class, inverse){
		if(!inverse){
			this.remove_class(element, old_class);
			this.add_class(element, new_class);
		}else{
			this.remove_class(element, new_class);
			this.add_class(element, old_class);
		}
	}

	, add_class: function(element, new_class){
		if(new_class && !this.has_class(element, new_class)){
			element.className += (element.className? ' ': '') + new_class;
		}
	}

	, remove_class: function(element, old_class){
		if(old_class){
			var id = 'remove+' + old_class;
			if(!this.patterns[id]){
				this.patterns[id] = new RegExp('(.*)(^|\\s+)('+ old_class + ')($|\\s+)(.*)');
			}
			if(this.has_class(element, old_class)){
				element.className =
					element.className.replace(
						this.patterns[id]
						, '$1$4$5'
					).replace(
						/^\s/
						, ''
					);
			}
		}
	}

	, has_class: function(element, which_class){
		var current = ' ' + element.className.replace(/[\t\n]+/g, ' ') + ' ';
		return current.match(' ' + which_class + ' ')? true: false;
	}

	, get_style: function(element, style_name, document_object){
		var i = style_name.indexOf('-');
		if(element.runtimeStyle && i > -1){
			style_name = style_name.substr(0, i) + style_name.substr(i + 1, 1).toUpperCase() + style_name.substr(i + 2);
		}
		var css = '';
		if(!document_object){
			document_object = document;
		}
		if(element.runtimeStyle){
			css = element.currentStyle[style_name];
		}else if(document_object.defaultView && document_object.defaultView.getComputedStyle){
			css = document_object.defaultView.getComputedStyle(element, null).getPropertyValue(style_name);
		}else if(element.style){
			css = element.style[style_name];
		}
		if(css && css.match(/rgb/)){
			css = css.replace(
				/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/ig,
				function(str, s1, s2, s3){
					var a = [
						(new Number(s1)).toString(16),
						(new Number(s2)).toString(16),
						(new Number(s3)).toString(16)
					];
					return '#' + (a[0].length < 2? '0' + a[0]: a[0]) + (a[1].length < 2? '0' + a[1]: a[1]) + (a[2].length < 2? '0' + a[2]: a[2]);
				}
			);
		}
		return css;
	}

	, set_style: function(element, css){
		if(typeof(element.style.cssText) != 'undefined') {
			element.style.cssText = css;
		}else{
			element.setAttribute('style', css);
		}
	}

	, get_inner_html: function(element, indent, preformatted){
		if(indent == undefined || preformatted){
			indent = '';
		}
		var child_node, html = '', tag, inner_html, attributes_html;
		for(var i = 0; i < element.childNodes.length; i++){
			child_node = element.childNodes[i];
			if(child_node.nodeType == 1){
				tag = reformator.html.tags.all[child_node.tagName];
				if(!preformatted && html){
					html = html.replace(/\n\s+$/, '\n');
				}
				if(!tag){
					html += this.get_inner_html(child_node, indent, preformatted);
				}else if(child_node.id.indexOf('reformator_selection_') != 0){
					inner_html = this.get_inner_html(child_node, indent + (tag.block? '\t': ''), preformatted || tag.preformatted);
					attributes_html = this.get_attributes_html(child_node);
					if(inner_html || tag.can_be_empty){
						if(!preformatted){
							if(tag.block && (!html || !html.match(/\n\s*$/))){
								html += '\n';
							}
							if(html && html.match(/\n\s*$/)){
								html += indent;
							}
						}
						html += '<' + tag.name + attributes_html + '>' + inner_html;
						if(!preformatted){
							if(tag.block && inner_html && inner_html.match(/\n/) && !inner_html.match(/\n\s*$/)){
								html += '\n';
							}
							if(html && html.match(/\n\s*$/)){
								html += indent;
							}
						}
						html += '</' + tag.name + '>';
						if(!preformatted && tag.block){
							html += '\n';
						}
					}else if(tag.empty){
						if(!preformatted && html && html.match(/\n\s*$/)){
							html += indent;
						}
						if(tag.name != 'br' || !preformatted){
							if(tag.name == 'img'){
								if(attributes_html.indexOf('width="') < 0){
									attributes_html += ' width="' + child_node.offsetWidth  + '"';
								}
								if(attributes_html.indexOf('height="') < 0){
									attributes_html += ' height="' + child_node.offsetHeight  + '"';
								}
							}
							html += '<' + tag.name + attributes_html + '/>';
						}
						if(tag.name == 'br'){
							html += '\n';
						}
					}
				}
			}else if(child_node.nodeType == 3 && child_node.nodeValue){
				var value = child_node.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				if(!preformatted){
					value = value.replace(/[\s\n\r]+/g, ' ');
				}
				html += value;
			}
		}
		return html;
	}

	, get_attributes_html: function(element){
		var attributes = reformator.html.tags.all[element.tagName].attributes, html = '', value;
		for(var s in attributes){
			if(attributes.constructor.prototype[s]) continue;
			value = element.getAttribute(s) + '';
			if(
				value
				&& s != 'class'
				&& value != attributes[s].null_value
				&& value != 'null'
			){
				if(s == 'href' || s == 'src' || s == 'action'){
					var t = this;
					value = value.replace(/^[^\/]+:\/\/([\.\/])/, '$1')
						.replace(/^(?:\.\/)*((?:\.\.\/)+)/,
							function(s0, s1){
								if(s1){
									var s = '/', i, ii = t.root_path.length - s1.length / 3;
									for(var i = 0; i < ii; i++){ s += t.root_path[i] + '/'; }
									return s;
								}else{
									return '';
								}
							}
						).replace(/^\.\/$/, '/' + t.root_path.join('/') + '/');
				}
				html += ' ' + s + '="' + value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\s\n\r]+/g, ' ') + '"';
			}
		}
		if(element.className){
			html += ' class="' + element.className + '"';
		}
		return html;
	}

	, listeners: []

	, fire_event: function(elements, events){
		if(!reformator.js.is_array(elements)){
			elements = [elements];
		}
		if(!reformator.js.is_array(events)){
			events = [events];
		}
		for(var i = 0, ii, event; i < elements.length; i++){
			for(ii = 0; ii < events.length; ii++){
				if(document.createEvent){
					if(events[ii].indexOf('key') == 0){
						try{
							event = document.createEvent('KeyEvents');
						}catch(error){
							event = document.createEvent('Events');
						}
						event.initEvent(events[ii], true, true, document.defaultView, 0, 0, 0, 0, 0);
					}else{
						event = document.createEvent('Events');
						event.initEvent(events[ii], true, true);
					}
					elements[i].dispatchEvent(event);
				}else if(elements[i].attachEvent && elements[i].fireEvent){
					elements[i].fireEvent('on' + events[ii]);
				}
			}
		}
	}

	, add_event_listener: function(element, event, listener){
		if(reformator.js.is_array(element)){
			for(var i = 0; i < element.length; i++){
				this.add_event_listener(element[i], event, listener);
			}
			return;
		}
		if(!event.match && reformator.js.is_array(event)){
			for(var i = 0; i < event.length; i++){
				this.add_event_listener(element, event[i], listener);
			}
			return;
		}
		this.listeners[this.listeners.length] = [element, event, listener];
		if(this.listeners.length == 1){
			this.init_detach_listeners(window);
		}
		if(element.addEventListener){
			element.addEventListener(event, listener, false);
		}else if(element.attachEvent){
			element.attachEvent('on' + event, listener);
		}
	}

	, remove_event_listener: function(element, event, listener){
		if(reformator.js.is_array(element)){
			for(var i = 0; i < element.length; i++){
				this.remove_event_listener(element[i], event, listener);
			}
			return;
		}
		if(!event.match && reformator.js.is_array(event.length)){
			for(var i = 0; i < event.length; i++){
				this.remove_event_listener(element, event[i], listener);
			}
			return;
		}
		if(element.removeEventListener){
			element.removeEventListener(event, listener, false);
		}else if(element.detachEvent){
			element.detachEvent('on' + event, listener);
		}
	}

	, init_detach_listeners: function(window_object){
		this.add_event_listener(window_object, 'unload', function(){
			reformator.dom_element.detach_listeners(window_object);
		});
	}

	, detach_listeners: function(window_object){
		for(var i = 0; i < this.listeners.length; i++){
			this.remove_event_listener(this.listeners[i][0], this.listeners[i][1], this.listeners[i][2]);
			this.listeners[i][0] = null;
		}
		this.listeners.length = 0;
		this.listeners = null;
		if(window_object.CollectGarbage){
			window_object.CollectGarbage();
		}
	}

	, cancel_event: function(event){
		if(!event){
			event = window.event;
		}
		event.cancelBubble = true;
		event.returnValue = false;
		if(event.cancelable){
			event.preventDefault();
			event.stopPropagation();
		}
		return false;
	}

	, normalize_event: function(event){
		if(!event){
			event = window.event;
		}
		if(event){
			event.element = event.target? event.target: event.srcElement;
			event.key_code = event.keyCode? event.keyCode: (event.which? event.which: null);
		}else{
			event = {};
		}
		return event;
	}

	, get_coords: function(event){
		if(!event){
			event = window.event;
		}
		var result = {left: 0, top: 0};
		if(event.pageX || event.pageY){
			result.left = event.pageX;
			result.top = event.pageY;
		}else if(event.clientX || event.clientY){
			result.left = event.clientX + document.body.scrollLeft - document.body.clientLeft;
			result.top = event.clientY + document.body.scrollTop - document.body.clientTop;
			if(document.body.parentElement && document.body.parentElement.clientLeft){
				var parent_element = document.body.parentElement;
				result.left += parent_element.scrollLeft - parent_element.clientLeft;
				result.top += parent_element.scrollTop - parent_element.clientTop;
			}
		}
		return result;
	}

	, replace_by: function(old_element, new_element){
		this.move_children(old_element, new_element);
		old_element.parentNode.insertBefore(new_element, old_element);
		old_element.parentNode.removeChild(old_element);
	}

	, replace_by_null: function(old_element){
		if(old_element.parentNode){
			this.move_children_before(old_element, old_element);
			old_element.parentNode.removeChild(old_element);
		}
	}

	, move_children_before: function(from_element, to_element){
		while(from_element.childNodes.length){
			to_element.parentNode.insertBefore(from_element.childNodes[0], to_element);
		}
	}

	, move_children: function(from_element, to_element){
		while(from_element.childNodes.length){
			to_element.appendChild(from_element.childNodes[0]);
		}
	}

	, get_common_sibling_nodes: function(start_node, end_node){
		var start = this.get_ancestors_elements(start_node, true);
		var end = this.get_ancestors_elements(end_node, true);
		for(var i = 0, common_sibling, current; i < start.length; i++){
			current = start[i];
			common_sibling = [];
			while(current){
				common_sibling[common_sibling.length] = current;
				if(current == end[i + end.length - start.length]){
					return common_sibling;
				}
				current = current.nextSibling;
			}
		}
		return null;
	}

	, get_ancestors_elements: function(node, with_self){
		var element = node.parentNode, ancestors = with_self ? [node] : [];
		while(
			element
			&& element.tagName
			&& element.tagName.toLowerCase() != 'body'
			&& element.tagName.toLowerCase() != 'html'
		){
			ancestors[ancestors.length] = element;
			element = element.parentNode;
		}
		return ancestors;
	}

	, get_first_ancestor_element: function(node, tag_name){
		var element = node.parentNode;
		if(tag_name){
			while(element.tagName && element.tagName.toLowerCase() != 'body' && element.tagName.toLowerCase() != tag_name){
				element = element.parentNode;
			}
			return element.tagName.toLowerCase() == tag_name ? element : null;
		}
		return element;
	}

	, get_first_previous_sibling_element: function(node, tag_name){
		var element = node;
		while(element && element.previousSibling){
			element = element.previousSibling;
			if(element.tagName && (!tag_name || element.tagName.toLowerCase() == tag_name)){
				return element;
			}
		}
		return null;
	}

	, get_next_sibling_element: function(node, tag_name){
		var element = node;
		while(element && element.nextSibling){
			element = element.nextSibling;
			if(element.tagName && (!tag_name || element.tagName.toLowerCase() == tag_name)){
				return element;
			}
		}
		return null;
	}
};


reformator.dom_selection = function(window_object){
	this.window = window_object;
	this.document = this.window.document;

	this.selection = this.get();

	this.on_change_functions = [];

	this.event = {};
	var t = this;
	reformator.dom_element.add_event_listener(
		this.window.addEventListener ? this.window : this.document,
		['keydown', 'keyup', 'mouseup', (this.window.addEventListener ? 'DOMAttrModified' : 'selectionchange')],
		function(event){
			event = reformator.dom_element.normalize_event(event);
			if(event.key_code){
				t.event.key_code = event.key_code;
				t.event.ctrlKey = event.ctrlKey;
				t.event.altKey = event.altKey;
				t.event.shiftKey = event.shiftKey;
				t.event.metaKey = event.metaKey;
			}else if(t.event.pageX || t.event.pageY){
				t.left = t.event.pageX;
				t.top = t.event.pageY;
			}else if(t.event.clientX || t.event.clientY){
				t.left = t.event.clientX + t.document.body.scrollLeft - t.document.body.clientLeft;
				t.top = t.event.clientY + t.document.body.scrollTop - t.document.body.clientTop;
			}
			if(t.on_change_timeout){
				clearTimeout(t.on_change_timeout);
			}
			t.on_change_timeout = setTimeout(function(){
				t.on_change(t.event);
				t.event = {};
			}, 200);
		}
	);
};

reformator.dom_selection.prototype = {
	add_on_change_function: function(f){
		this.on_change_functions[this.on_change_functions.length] = f;
	}

	, on_change: function(event){
		//document.title+='0';
		this.refresh();
		for(var i = 0; i < this.on_change_functions.length; i++){
			this.on_change_functions[i](event);
		}
	}

	, refresh: function(){
		//if(!this.selection){ FF bug after maximize
			this.selection = this.get();
		//}
		this.range = this.get_range();
	}

	, get_type: function(){
		//if(!this.range){
			this.range = this.get_range();
		//}
		var collapsed = this.collapsed();
		if(collapsed){
			return 'none';
		}else if(
			(this.range.toString && !this.range.toString())
			|| this.selection.type == 'Control'
			|| (this.range.htmlText && !this.range.htmlText.replace(/<\/?[a-z]+[^>]*>/ig, ''))
		){
			return 'element';
		}else{
			return 'text';
		}
	}

	, collapsed: function(){
		if(!this.range){
			this.range = this.get_range();
		}
		if(!this.range){
			return false;
		}else{
			if(this.range.compareEndPoints){
				return this.range.compareEndPoints('StartToEnd', this.range) === 0;
			}else{
				return !this.selection || this.range.collapsed || this.range.boundingWidth == 0;
			}
		}
	}

	, collapse: function(start){
		if(!this.range){
			this.range = this.get_range();
		}
		if(this.range.select){
			// For IE
			this.range.collapse(start);
			this.range.select();
		}else{
			// For FF
			if(start){
				this.range.setEnd(this.range.startContainer, this.range.startOffset);
			}else{
				this.range.setStart(this.range.endContainer, this.range.endOffset);
			}
			// For other
			this.range.collapse(start);
			this.selection.removeAllRanges();
			this.selection.addRange(this.range);
		}
	}

	, select_node: function(node){
		if(node){
			var range;
			if(!this.window.getSelection){
				range = this.document.body.createTextRange();
				try{
					range.moveToElementText(node);
					range.select(node);
					this.range = range;
				}catch(error){}
			}else{
				if(this.selection){
					range = this.document.createRange();
					try{
						range.selectNode(node);
					}catch(error){
						range.selectNodeContents(node);
					};
					this.selection.removeAllRanges(range);
					this.selection.addRange(range);
					this.range = range;
				}
			}
			this.refresh();
		}
	}

	, get_inner_html: function(){
		this.range = this.get_range();
		if(this.range.cloneContents){
			this._init_document_fragment();
			this.document_fragment.appendChild(this.range.cloneContents());
			return this.document_fragment.innerHTML;
		}else{
			return this.range.htmlText;
		}
	}

	, get_inner_text: function(){
		this.range = this.get_range();
		if(this.range.cloneContents){
			this._init_document_fragment();
			this.document_fragment.appendChild(this.range.cloneContents());
			return this.document_fragment.innerText || this.document_fragment.textContent || ' ';
		}else{
			return this.range.text;
		}
	}

	, _init_document_fragment: function(){
		if(!this.document_fragment){
			this.document_fragment = this.document.createElement('div');
		}
		this.document_fragment.innerHTML = '';
	}

	, get_start_node: function(){
		if(this.range.startContainer){
			return this.document.getElementById('reformator_selection_0');
		}else if(this.range.parentElement){
			var range = this.range.duplicate();
			//range.moveStart('character', 1);
			range.collapse(true);
			var parent_element = range.parentElement();
			for(var i = 0, child_node, last_text_node = null; i < parent_element.childNodes.length; i++){
				child_node = parent_element.childNodes[i];
				if(child_node.nodeType == 1){
					range.moveToElementText(child_node);
					if(this.range.compareEndPoints('StartToEnd', range) < 0 && last_text_node){
						return last_text_node;
					}
					last_text_node = null;
				}else if(!last_text_node){
					last_text_node = child_node;
				}
			}
			return last_text_node || parent_element.firstChild || parent_element;
		}
	}

	, get_end_node: function(){
		if(this.range.startContainer){
			return this.document.getElementById('reformator_selection_1');
		}else if(this.range.parentElement){
			var range = this.range.duplicate();
			range.collapse(false);
			var parent_element = range.parentElement();
			for(var i = parent_element.childNodes.length - 1, child_node, last_text_node = null; i >= 0; i--){
				child_node = parent_element.childNodes[i];
				if(child_node.nodeType == 1){
					range.moveToElementText(child_node);
					if(this.range.compareEndPoints('EndToEnd', range) > 0 && last_text_node){
						return last_text_node;
					}
					last_text_node = null;
				}else if(!last_text_node){
					last_text_node = child_node;
				}
			}
			return last_text_node || parent_element.lastChild || parent_element;
		}
	}

	, get_parent_element: function(){
		//if(!this.range){
			this.range = this.get_range();
		//}
		var parent_element = null;
		if(!this.window.getSelection){
			if(this.selection.type == 'Control'){
				parent_element = this.range.item(0).parentNode;
			}else{
				parent_element = this.range.parentElement();
				//var i = 0;
				//while(!parent_element && i < 1){
				//	parent_element = this.range.parentElement ? this.range.parentElement() : null;
				//	if(parent_element){
				//		var parent_range = this.document.body.createTextRange();
				//		try{
				//			parent_range.moveToElementText(parent_element);
				//			if(!parent_range.inRange(range)){
				//				parent_element = null;
				//				//range.moveEnd('character', -2)
				//				//range.select();
				//			}
				//		}catch(error){
				//			parent_element = null;
				//		}
				//	}
				//	i++;
				//}
			}
		}else{
			//if(
			//	!range.collapsed && range.startContainer == range.endContainer
			//	&& range.startOffset - range.endOffset <= 1
			//	&& range.startContainer.hasChildNodes()
			//){
			//	parent_element = range.startContainer.childNodes[range.startOffset];
			//}else{
				parent_element = this.range.commonAncestorContainer;
			//}
			while(parent_element && parent_element.nodeType == 3){
				parent_element = parent_element.parentNode;
			}
		}
		return parent_element;
	}

	, store: function(){
		var bookmark = null;
		//if(!this.range){
			this.range = this.get_range();
		//}
		if(this.range && this.range.getBookmark){
			bookmark = {string: this.range.getBookmark(), collapsed: this.collapsed()};
		}else if(this.range.cloneRange){
			for(var i = 0, clone_range, id, selection_element; i < 2; i++){
				id = 'reformator_selection_' + (1 - i);
				clone_range = this.range.cloneRange();
				//clone_range.collapse(i != 0);
				// collapse not always work in Opera 10
				if(i == 0){
					clone_range.setStart(clone_range.endContainer, clone_range.endOffset);
				}else{
					clone_range.setEnd(clone_range.startContainer, clone_range.startOffset);
				}
				selection_element = this.document.getElementById(id);
				if(!selection_element){
					selection_element = this.document.createElement('wbr');
					selection_element.id = id;
				}
				try{
					clone_range.insertNode(selection_element);
					//selection_element.parentNode.normalize(); bug with collapsed selection in Opera 11
				}catch(e){}
			}
			//this.selection.removeAllRanges();
			//this.selection.addRange(this.range);
			if(!window.opera){
				this.restore(null, true); //bug in Opera 11.53
			}
		}
		return bookmark;
	}

	, restore: function(bookmark, from_store){
		if(bookmark && bookmark.string){
			if(!this.range){
				this.range = this.get_range();
			}
			if(this.range.moveToBookmark && this.range.moveToBookmark(bookmark.string)){
				var range = this.range.duplicate();
				if(!bookmark.collapsed){
					range.moveEnd('character', -2);
				}
				if(this.range.text == range.text){
					range.select();
				}else{
					this.range.select();
				}
			}
		}else if(bookmark && bookmark.tagName){
			this.select_node(bookmark);
		}else{
			var start = this.document.getElementById('reformator_selection_0');
			if(start){
				this.range = this.document.createRange();
				this.range.setStartAfter(start);
				var end = this.document.getElementById('reformator_selection_1');
				if(end){
					this.range.setEndBefore(end);
					if(!this.range.toString()){
						var children = this.range.cloneContents().childNodes;
						for(var i = 0, collapse = true; i < children.length; i++){
							if(children[i].tagName && children[i].id.indexOf('reformator_selection_') < 0){
								collapse = false;
							}
						}
						if(collapse){
							if(window.opera){
								this.range.setStartBefore(end); // For Opera
							//}else{
								//try{// For FF 1.5
									//this.range.setEndBefore(start); // For FF 3.6
								//}catch(e){};
							}
							this.collapse(true);
							//end.parentNode.removeChild(end);
						}
					}
				}
				this.selection.removeAllRanges();
				try{ //For FF 9
					this.selection.addRange(this.range);
				}catch(e){};
			}
		}
	}

	, get_range: function(){
		var range;
		try{
			if(this.selection){
				if(this.selection.rangeCount > 0){
					range = this.selection.getRangeAt(0);
				}else if(this.selection.createRange){
					range = this.selection.createRange();
				}else{
					range = this.document.createRange();
				}
			}
		}catch(error){
		};
		if(!range){
			range = this.document.createRange ? this.document.createRange() : this.document.body.createTextRange();
		}
		return range;
	}

	, get: function(){
		return this.window.getSelection? this.window.getSelection(): this.document.selection;
	}
};


reformator.language = {
	init: function(){
		this.inited = true;
		this.upper_letters = '';
		this.lower_letters = '';
		for(var s in this.type){
			if(this.type.constructor.prototype[s]) continue;
			this.type[s].upper = this.type[s].common_upper;
			this.upper_letters += this.type[s].common_upper;

			this.type[s].lower = this.type[s].common_lower;
			this.lower_letters += this.type[s].common_lower;

			this.type[s].common = this.type[s].common_upper + this.type[s].common_lower;
			this.type[s].common_pattern = new RegExp('[' + this.type[s].common + ']', 'g');
		}
		this.abc_length = 0;
		for(var s in this.abc){
			this.abc_length++;
			if(this.abc.constructor.prototype[s]) continue;
			this.abc[s].upper = this.type[this.abc[s].type].common_upper + this.abc[s].unique_upper;
			if(!this.type[this.abc[s].type].upper){this.type[this.abc[s].type].upper = '';}
			this.type[this.abc[s].type].upper += this.abc[s].unique_upper;
			this.upper_letters += this.abc[s].unique_upper;

			this.abc[s].lower = this.type[this.abc[s].type].common_lower + this.abc[s].unique_lower;
			if(!this.type[this.abc[s].type].lower){this.type[this.abc[s].type].lower = '';}
			this.type[this.abc[s].type].lower += this.abc[s].unique_lower;
			this.lower_letters += this.abc[s].unique_lower;

			this.abc[s].unique = this.abc[s].unique_upper + this.abc[s].unique_lower;
			this.abc[s].unique_pattern = new RegExp('[' + this.abc[s].unique + ']', 'g');

		}
		while(this.upper_letters.match(/(.)(.*?)\1/)){
			this.upper_letters = this.upper_letters.replace(/(.)(.*?)\1/g, '$1$2');
		}
		while(this.lower_letters.match(/(.)(.*?)\1/)){
			this.lower_letters = this.lower_letters.replace(/(.)(.*?)\1/g, '$1$2');
		}
		this.letters = this.upper_letters + this.lower_letters;
		this.simple_word_pattern = new RegExp('[' + this.letters + '0-9’′\']');
	}

	, get: function(text, params){
		if(!params){
			params = {};
		}
		if(!params.limit){params.limit = 5000}
		if(!params.limited_parts){params.limited_parts = 5}

		text = text.replace(/[^\s]*_[^\s]*/g, ' ');

		if(text.length > params.limit){
			var part_length = Math.floor(params.limit / params.limited_parts);
			var part_offset = Math.floor((text.length - params.limit) / params.limited_parts);
			for(var i = 0, limited_text = ''; i < params.limited_parts; i++){
				limited_text += text.substr(i * part_offset, part_length);
			}
			text = limited_text;
		}

		var type_letters_counters = [], letters;
		for(var s in this.type){
			if(this.type.constructor.prototype[s]) continue;
			letters = text.match(this.type[s].common_pattern);
			type_letters_counters[s] = letters? letters.length: 0;
		}

		var abc = [], letters_count, i = 0, max_letters_count = 0, need_words = false, words;
		for(var s in this.abc){
			letters_count = type_letters_counters[this.abc[s].type];
			letters = text.match(this.abc[s].unique_pattern);
			if(letters_count || letters){
				if(letters){
					letters_count += letters.length;
				}
				if(max_letters_count <= letters_count){
					if((letters_count - max_letters_count) / letters_count <= 0.01){
						need_words = true;
					}
					max_letters_count = letters_count;
					abc[i] = {
						i: i
						, abbr: s
						, letters_count: letters_count
					};
					i++;
				}
			}
		}

		if(need_words){
			for(i = 0; i < abc.length; i++){
				if(this.abc[abc[i].abbr].words){
					words = text.match(this.abc[abc[i].abbr].words);
					abc[i].words_count = words ? words.length : 0;
				}
			}
			abc.sort(function(o1, o2){
				var delta = o2.letters_count > o1.letters_count
					? (o2.letters_count - o1.letters_count) / o2.letters_count
					: (
						o1.letters_count > o2.letters_count
						? (o1.letters_count - o2.letters_count) / o1.letters_count
						: 0
					);
				if(delta <= 0.01){
					return o2.words_count == o1.words_count ? o1.i - o2.i : o2.words_count - o1.words_count;
				}else{
					return o2.letters_count - o1.letters_count;
				}
			});
		}else{
			abc.sort(function(o1, o2){
				return o1.letters_count > o2.letters_count ? -1: (o1.letters_count == o2.letters_count? o1.i - o2.i: 1);
			});
		}

		return abc[0] ? abc[0].abbr : '';
	}

	, type: {
		cyr: {common_upper: 'АБВГДЕЖЗКЛМНОПРСТУФХЧШ', common_lower: 'абвгдежзклмнопрстуфхчш'}
		, lat: {common_upper: 'ABDEGHILMNOPRSTU', common_lower: 'abdeghilmnoprstu'}
	}

	, abc: {
		ru: {name: 'Russian', type: 'cyr', unique_upper: 'ЁИЙЦЩЪЫЬЭЮЯ', unique_lower: 'ёийцщъыьэюя',
			words: /(?:\s|^)(и|в|не|на|с|что|а|как|то|из|по|он|все|это|его|к|еще|для|бы|же)(\s|$)/gi},
		en: {name: 'English', type: 'lat', unique_upper: 'CFJKQVWXYZ', unique_lower: 'cfjkqvwxyz',
			words: /(?:\s|^)(the|of|and|to|a|in|i|is|it|he|as|for|you|are|was|on|not|by|or|but)(\s|$)/gi},
		es: {name: 'Spanish', type: 'lat', unique_upper: 'CFJKQVWXYZÁÉÍÑÓÚÜ', unique_lower: 'cfjkqvwxyzáéíñóúü',
			words: /(?:\s|^)(de|el|la|y|que|en|a|los|un|se|no|es|las|una|por|del|me|con|su|al)(\s|$)/gi},
		fr: {name: 'French', type: 'lat', unique_upper: 'CFJKQVWXYZÀÂÆÇÈÉÊËÎÏÔŒÙÛÜŸ', unique_lower: 'cfjkqvwxyzàâæçèéêëîïôœùûüÿ',
			words: /(?:\s|^)(de|la|les|et|le|il|l'|à|des|un|d'|en|une|du|est|qui|par|que|au|ce)(\s|$)/gi},
		de: {name: 'German', type: 'lat', unique_upper: 'CFJKQVWXYZÄÖßÜ', unique_lower: 'cfjkqvwxyzäößü',
			words: /(?:\s|^)(und|der|die|ich|in|zu|von|den|das|mit|des|als|auf|so|ein|war|dem|an|ist|es)(\s|$)/gi},
		pt: {name: 'Portuguese', type: 'lat', unique_upper: 'CFJQVXZÀÁÂÃÇÉÊÍÓÔÕÚÜ', unique_lower: 'cfjqvxzàáâãçéêíóôõúü',
			words: /(?:\s|^)(de|e|a|o|que|do|da|um|uma|os|em|se|na|no|as|com|dos|por|ou|ele)(\s|$)/gi},
		it: {name: 'Italian', type: 'lat', unique_upper: 'CFQVZÀÈÉÌÒÙ', unique_lower: 'cfqvzàèéìòù',
			words: /(?:\s|^)(e|di|la|che|il|a|un|in|per|si|i|non|l\'|una|le|gli|da|del|ma|lo)(\s|$)/gi},
		tr: {name: 'Turkish', type: 'lat', unique_upper: 'CFJKVYZÂÇĞİÖŞÜ', unique_lower: 'cfjkvyzâçğıöşü'},
		pl: {name: 'Polish', type: 'lat', unique_upper: 'CFJKWYZĄĆĘŁŃÓŚŹŻ', unique_lower: 'cfjkwyząćęłńóśźż',
			words: /(?:\s|^)(i|w|na|nie|z|że|do|o|a|to|jak|ale|jej|od|ja|po|co|za|tak|ich)(\s|$)/gi},
		nl: {name: 'Netherland', type: 'lat', unique_upper: 'CFJKQVWXYZÄÈÉËÏĲÖÜ', unique_lower: 'cfjkqvwxyzäèéëïĳöü'},
		ro: {name: 'Romanian', type: 'lat', unique_upper: 'CFJKVXZÂĂÎȘŢ', unique_lower: 'cfjkvxzâăîșţ',
			words: /(?:\s|^)(şi|de|să|se|ca|în|o|a|la|cu|pe|nu|mai|ce|un|îi|din|i|el|cum)(\s|$)/gi},
		sv: {name: 'Swedish', type: 'lat', unique_upper: 'CFJKQVWXYZÄÅÖÜ', unique_lower: 'cfjkqvwxyzäåöü'},
		uk: {name: 'Ukrainian', type: 'cyr', unique_upper: 'ҐЄІЇИЙЦЩЬЮЯ', unique_lower: 'ґєіїийцщьюя',
			words: /(?:\s|^)(не|i|на|з|що|в|й|а|у|як|до|та|ще|це|ж|за|там|для|iз|чи)(\s|$)/gi},
		cs: {name: 'Czech', type: 'lat', unique_upper: 'CFJKVYZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ', unique_lower: 'cfjkvyzáčďéěíňóřšťúůýž',
			words: /(?:\s|^)(a|se|je|to|na|v|si|ale|ze|tak|o|mé|mi|co|pro|s|by|aby|z|byl)(\s|$)/gi},
		hu: {name: 'Hungarian', type: 'lat', unique_upper: 'CFJKVZÁÉÍÓÖŐÚÜŰ', unique_lower: 'cfjkvzáéíóöőúüű'},
		no: {name: 'Norwegian', type: 'lat', unique_upper: 'CFJKQVWXYZÅÆØ', unique_lower: 'cfjkqvwxyzåæø'},
		bg: {name: 'Bulgarian', type: 'cyr', unique_upper: 'ИЙЦЩЪЬЮЯ', unique_lower: 'ийцщъьюя',
			words: /(?:\s|^)(на|и|за|да|се|в|от|с|е|по|или|при|чл|са|не|ще|до|ус|те|има)(\s|$)/gi},
		fi: {name: 'Finnish', type: 'lat', unique_upper: 'CFJKQVWXYZÄÅÖŠ', unique_lower: 'cfjkqvwxyzäåöš'},
		be: {name: 'Belarusian', type: 'cyr', unique_upper: 'ЁІЙЎЦЫЬЭЮЯ', unique_lower: 'ёійўцыьэюя',
			words: /(?:\s|^)(і|у|на|ён|не|з|яго|што|але|ад|як|а|ўсё|да|па|за|ўжо|пад|іх|ж)(\s|$)/gi},
		sk: {name: 'Slovak', type: 'lat', unique_upper: 'CFJKQVWXYZÁÄČĎÉÍŇÓÔŔŠŤÚÝŽ', unique_lower: 'cfjkqvwxyzáäčďéíňóôŕšťúýž'},
		ga: {name: 'Irish', type: 'lat', unique_upper: 'CFÁÉÍÓÚ', unique_lower: 'cfáéíóú'},
		hr: {name: 'Croatian', type: 'lat', unique_upper: 'CFJKVZĆČĐŠŽ', unique_lower: 'cfjkvzćčđšž'},
		kk: {name: 'Kazakh', type: 'cyr', unique_upper: 'ӘҒЁІИЙҚҢӨҰҮҺЦЩЪЫЬЭЮЯ', unique_lower: 'әғёіийқңөұүһцщъыьэюя',
			words: /(?:\s|^)(мен|бір|де|бұл|да|бар|жж|осы|өз|ол|шет|ету|әр|ж|қр|жыл|ақ|деп|екі|іс)(\s|$)/gi},
		//sr: {name: 'Serbian', type: 'cyr', unique_upper: 'ЂИЈЉЊЋЦЏ', unique_lower: 'ђијљњћцџ'},
		lt: {name: 'Lithuanian', type: 'lat', unique_upper: 'CFJKXYZĄČĖĘĮŠŪŲŽ', unique_lower: 'cfjkxyząčėęįšūųž'},
		lv: {name: 'Latvian', type: 'lat', unique_upper: 'CFJKVZĀČĒĢĪĶĻŅŠŪŽ', unique_lower: 'cfjkvzāčēģīķļņšūž',
			words: /(?:\s|^)(un|ir|kā|ar|kas|no|par|to|tā|vai|uz|tas|bet|jau|var|lai|gan|ko|nav|ja)(\s|$)/gi},
		da: {name: 'Danish', type: 'lat', unique_upper: 'CFJKQVWXYZÅÆØ', unique_lower: 'cfjkqvwxyzåæø'},
		sl: {name: 'Slovene', type: 'lat', unique_upper: 'CFJKVZČŠŽ', unique_lower: 'cfjkvzčšž'},
		et: {name: 'Estonian', type: 'lat', unique_upper: 'FJKVZÄÕÖŠÜ', unique_lower: 'fjkvzäõöšü'},
		mo: {name: 'Moldavian', type: 'cyr', unique_upper: 'ӁИЙЦЫЬЭЮЯ', unique_lower: 'ӂийцыьэюя'},
		//mk: {name: 'Macedonian', type: 'cyr', unique_upper: 'ЃЅИЈЌЉЊЦЏ', unique_lower: 'ѓѕијќљњцџ'},
		sq: {name: 'Albanian', type: 'lat', unique_upper: 'CFJKQVXYZÇË', unique_lower: 'cfjkqvxyzçë'},
		//is: {name: 'Icelandic', type: 'lat', unique_upper: 'FJKVXYÁÆÐÉÍÓÖÞÚ', unique_lower: 'fjkvxyáæðéíóöþú'},
		//sc: {name: 'Scottish', type: 'lat', unique_upper: 'CFÀÈÌÒÙ', unique_lower: 'cfàèìòù'},
		eo: {name: 'Esperanto', type: 'lat', unique_upper: 'CFJKVZĈĜĤĴŜŬ', unique_lower: 'cfjkvzĉĝĥĵŝŭ'},
		el: {name: 'Greek', type: 'lat', unique_upper: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩϜϚϘϠ', unique_lower: 'αβγδεζηθικλμνξοπρσςτυφχψωϝϛϙϡ'},

		//ab: {name: 'Abkhazian', type: 'cyr', unique_upper: 'ҔЏҼҾҘӠИҞҨҦҪҬҲЦҴҶЫ', unique_lower: 'ҕџҽҿҙӡиҟҩҧҫҭҳцҵҷы'},
		//az: {name: 'Azerbaijani', type: 'lat', unique_upper: 'CFJKQVXYZÇƏĞİÖŞÜ', unique_lower: 'cfjkqvxyzçəğıöşü'},
		//ce: {name: 'Chechen', type: 'lat', unique_upper: 'CFJKQVXYZÄÇƏĠÖŞÜ', unique_lower: 'cfjkqvxyzäçəġöşü'},
		ky: {name: 'Kirghiz', type: 'cyr', unique_upper: 'ЁИЙҢӨҮЦЩЪЫЬЭЮЯ', unique_lower: 'ёийңөүцщъыьэюя'},
		os: {name: 'Ossetic', type: 'cyr', unique_upper: 'ӔЁИЙЦЩЪЫЬЭЮЯ', unique_lower: 'ӕёийцщъыьэюя'},
		//tt: {name: 'Tatar', type: 'lat', unique_upper: 'CFJKQVWXYZÁÂÄÇÉĞÍİÑÓÖŞÚÜ', unique_lower: 'cfjkqvwxyzáâäçéğíıñóöşúü'},
		//tk: {name: 'Turkmen', type: 'lat', unique_upper: 'FJKWYZÄÇŇÖŞÜÝ', unique_lower: 'fjkwyzäçňöşüý'},
		tg: {name: 'Tajik', type: 'cyr', unique_upper: 'ҒЁИЙӢҚӮҲҶЪЭЮЯ', unique_lower: 'ғёийӣқӯҳҷъэюя'}//,
		//uz: {name: 'Uzbek', type: 'lat', unique_upper: 'CFJKQVXYZ', unique_lower: 'cfjkqvxyz'},
		//vi: {name: 'Vietnamese', type: 'lat', unique_upper: 'CKQVXYÂĂĐÊÔƠƯ', unique_lower: 'ckqvxyâăđêôơư'}
	}
};


reformator.html = {
	remove_tags: function(text){
		return text.replace(/<(?:[\/\?\!]?\w+[^>]*|\!--(?:.|\n)*?--|%(?:.|\n)*?%)>/g, '');
	},

	remove_entities: function(text){
		return text.replace(/&([a-zA-Z\d]|\#\d+);/g, '\x20');
	},

	replace_entities: function(text, params){
		if(!params){
			params = {};
		}
		if(!params.group){params.group = 'common';}
		if(!params.type){params.type = 0;}
		if(!this.pattern){
			this.pattern = [];
		}
		var i, replaced = [];
		for(var s in this.entities[params.group]){
			for(i = 0; i < 4; i++){
				if(i != params.type){
					if(!replaced[this.entities[params.group][s][i]] && this.entities[params.group][s][params.type]){
						replaced[this.entities[params.group][s][i]] = true;
						if(!this.pattern[this.entities[params.group][s][i]]){
							this.pattern[this.entities[params.group][s][i]] = new RegExp(this.entities[params.group][s][i], 'g');
						}
						text = text.replace(this.pattern[this.entities[params.group][s][i]], this.entities[params.group][s][params.type]);
					}
				}
			}
		}
		return text;
	},

	init: function(){
		this.inited = true;
		var attributes, ss;
		for(var s in this.tags.all){
			if(this.tags.all.constructor.prototype[s]) continue;
			this.tags.all[s].name = s.toLowerCase();
			if(!this.tags.all[s].attributes){
				this.tags.all[s].attributes = {};
			}
			attributes = this.tags.all[s].attributes;
			attributes['class'] = {};
			attributes['title'] = {};
			for(ss in attributes){
				if(attributes.constructor.prototype[ss]) continue;
				attributes[ss].name = ss.toLowerCase();
				//attributes[ss.toUpperCase()] = attributes[ss];
			}
			this.tags.all[s.toUpperCase()] = this.tags.all[s];
		}
	},

	tags: {
		all: {
			a:            {inline: true, attributes: {href: {}, name: {}, target: {}}}
			, abbr:       {inline: true}
			, acronym:    {inline: true}
			, address:    {block: true, inline_only: true}
			, applet:     {deprecated: true, remove: true}
			, area:       {empty: true, parents: {map: {}}, attributes: {alt: {}, coords: {}, href: {}, shape: {}}}
			, audio:      {block: true, inline: true, attributes: {src: {}, controls: {}, autoplay: {}, preload: {}, loop: {}}, can_be_empty: true}        
			, b:          {inline: true, replace_with: 'strong'}
			, base:       {empty: true, parents: {head: {}}, attributes: {href: {}}}
			, bdo:        {inline: true, attributes: {dir: {}}}
			, basefont:   {deprecated: true, empty: true}
			, big:        {inline: true, replace_with: 'strong'}
			, blockquote: {block: true}
			, body:       {block: true}
			, br:         {inline: true, empty: true}
			, button:     {inline: true, attributes: {id: {}, name: {}, value: {}}}
			, caption:    {block: true, inline_only: true, parents: {table: {}}, can_be_empty: true}
			, center:     {block: true, deprecated: true, remove: true}
			, cite:       {inline: true}
			, code:       {inline: true, dont_modify_text: true}
			, col:        {empty: true, parents: {colgroup: {}}}
			, colgroup:   {block: true, parents: {table: {}}}
			, dd:         {block: true, parents: {dl: {}}}
			, del:        {inline: true}
			, dfn:        {inline: true}
			, dir:        {block: true, deprecated: true, replace_with: 'ul'}
			, div:        {block: true}
			, dl:         {block: true, children: {dt: {}, dd: {}}}
			, dt:         {block: true, inline_only: true, parents: {dl: {}}}
			, em:         {inline: true}
			, embed:      {block: true, inline: true, attributes: {src: {}, type: {}, allowfullscreen: '', width: {}, height: {}}, can_be_empty: true}       
			, fieldset:   {block: true}
			, font:       {inline: true, deprecated: true, remove: true}
			, form:       {block: true, attributes: {id: {}, name: {}, action: {}, method: {}}}
			, frame:      {block: true, attributes: {name: {}, src: {}}}
			, frameset:   {block: true}
			, h1:         {block: true, inline_only: true}
			, h2:         {block: true, inline_only: true}
			, h3:         {block: true, inline_only: true}
			, h4:         {block: true, inline_only: true}
			, h5:         {block: true, inline_only: true}
			, h6:         {block: true, inline_only: true}
			, head:       {block: true, parents: {html: {}}}
			, hr:         {block: true, empty: true}
			, html:       {block: true}
			, i:          {inline: true, replace_with: 'em'}
			, iframe:     {block: true, attributes: {name: {}, src: {}, width: {}, height: {}}}
			, img:        {inline: true, empty: true, attributes: {src: {}, alt: {}, width: {}, height: {}, usemap: {}}}
			, input:      {inline: true, empty: true, attributes: {id: {}, name: {}, value: {}, checked: {}, type: {}, length: {}, maxlength: {}}}          
			, ins:        {block: true, inline: true}
			, isindex:    {block: true, empty: true, deprecated: true, remove: true, attributes: {prompt: {}}}
			, kbd:        {inline: true}
			, label:      {inline: true, attributes: {'for': {}}}
			, legend:     {block: true, inline_only: true}
			, li:         {block: true, parents: {ul: {}, ol: {}}}
			, link:       {empty: true, parents: {head: {}}, attributes: {src: {}, type: {}, rel: {}}}
			, map:        {attributes: {name: {}}}
			, menu:       {block: true, deprecated: true, replace_with: 'ul'}
			, meta:       {empty: true, parents: {head: {}}}
			, nobr:       {inline: true}
			, noframes:   {block: true, remove: true}
			, noscript:   {block: true, remove: true}
			, object:     {block: true, inline: true, attributes: {width: {}, height: {}, data: {}, type: {}}, can_be_empty: true}
			, ol:         {block: true, children: {li: {}}}
			, optgroup:   {block: true, parents: {select: {}}}
			, option:     {block: true, inline: true, parents: {select: {}, optgroup: {}}, attributes: {value: {}, selected: {}}}
			, p:          {block: true, inline_only: true}
			, param:      {empty: true, parents: {object: {}, applet: {}}, attributes: {name: {}, value: {}}}
			, pre:        {block: true, preformatted: true}
			, q:          {inline: true}
			, s:          {inline: true, deprecated: true, replace_with: 'del'}
			, samp:       {inline: true, dont_modify_text: true}
			, script:     {block: true, remove_with_content: true, preformatted: true, attributes: {src: {}, type: {}}}
			, select:     {block: true, inline: true, attributes: {id: {}, name: {}}}
			, small:      {inline: true, remove: true}
			, span:       {inline: true, remove_without_class: true}
			, strike:     {inline: true, deprecated: true, replace_with: 'del'}
			, strong:     {inline: true}
			, style:      {block: true, remove_with_content: true, preformatted: true, attributes: {type: {}}}
			, sub:        {inline: true}
			, sup:        {inline: true}
			, table:      {block: true, children: {caption: {}, thead: {}, tbody: {}, tfoot: {}, tr: {}, td: {}, th:{}}}
			, tbody:      {block: true, parents: {table: {}}, children: {tr: {}, td: {}, th:{}}}
			, td:         {block: true, can_be_empty: true, parents: {tr: {}}, attributes: {colspan: {null_value: '1'}, rowspan: {null_value: '1'}}}     
			, textarea  : {can_be_empty: true, attributes: {id: {}, name: {}, value: {}, cols: {}, rows: {}}}
			, tfoot:      {block: true, parents: {table: {}}, children: {tr: {}, td: {}, th:{}}}
			, th:         {block: true, can_be_empty: true, parents: {tr: {}}, attributes: {colspan: {null_value: '1'}, rowspan: {null_value: '1'}}}     
			, thead:      {block: true, parents: {table: {}}, children: {tr: {}, td: {}, th:{}}}
			, title:      {parents: {head: {}}}
			, tr:         {block: true, parents: {table: {}, tbody: {}, thead: {}, tfoot: {}}, children: {td: {}, th:{}}}
			, tt:         {}
			, u:          {inline: true, deprecated: true, replace_with: 'strong'}
			, ul:         {block: true, children: {li: {}}}
			, wbr:        {inline: true, empty: true}
			, 'var':      {inline: true, dont_modify_text: true}
			, video:      {block: true, inline: true, attributes: {src: {}, controls: {}, autoplay: {}, preload: {}, loop: {}, width: {}, height: {}, audio: {}, poster: {}}, can_be_empty: true}
		}
	},

	entities: {
		special: {
			amp:        ['&',    '&amp;',     '&amp;',       '&#38;']
			, gt:       ['>',    '&gt;',      '&gt;',        '&#62;']
			, lt:       ['<',    '&lt;',      '&lt;',        '&#60;']
			, quot:     ['\"',   '&quot;',    '&quot;',      '&#34;']
		}

		, common: {
			Aacute:     ['Á',    '&Aacute;',   '&Aacute;',   '&#193;']
			, aacute:   ['á',    '&aacute;',   '&aacute;',   '&#225;']
			, Acirc:    ['Â',    '&Acirc;',    '&Acirc;',    '&#194;']
			, acirc:    ['â',    '&acirc;',    '&acirc;',    '&#226;']
			, acute:    ['´',    '&acute;',    '&acute;',    '&#180;']
			, AElig:    ['Æ',    '&AElig;',    '&AElig;',    '&#198;']
			, aelig:    ['æ',    '&aelig;',    '&aelig;',    '&#230;']
			, Agrave:   ['À',    '&Agrave;',   '&Agrave;',   '&#192;']
			, agrave:   ['à',    '&agrave;',   '&agrave;',   '&#224;']
			, alefsym:  ['ℵ',    '&alefsym;',  '&alefsym;',  '&#8501;']
			, Alpha:    ['Α',    '&Alpha;',    '&Alpha;',    '&#913;']
			, alpha:    ['α',    '&alpha;',    '&alpha;',    '&#945;']
			, Aring:    ['Å',    '&Aring;',    '&Aring;',    '&#197;']
			, aring:    ['å',    '&aring;',    '&aring;',    '&#229;']
			, asymp:    ['≈',    '&asymp;',    '&asymp;',    '&#8776;']
			, Atilde:   ['Ã',    '&Atilde;',   '&Atilde;',   '&#195;']
			, atilde:   ['ã',    '&atilde;',   '&atilde;',   '&#227;']
			, Auml:     ['Ä',    '&Auml;',     '&Auml;',     '&#196;']
			, auml:     ['ä',    '&auml;',     '&auml;',     '&#228;']
			, bdquo:    ['„',    '&#132;',     '&bdquo;',    '&#8222;']
			, Beta:     ['Β',    '&Beta;',     '&Beta;',     '&#914;']
			, beta:     ['β',    '&beta;',     '&beta;',     '&#946;']
			, brvbar:   ['¦',    '&brvbar;',   '&brvbar;',   '&#166;']
			, bsquo:    [',',    ',',          ',',          ',']
			, bull:     ['•',    '&bull;',     '&bull;',     '&#8226;']
			, cap:      ['∩',    '&cap;',      '&cap;',      '&#8745;']
			, Ccedil:   ['Ç',    '&Ccedil;',   '&Ccedil;',   '&#199;']
			, ccedil:   ['ç',    '&ccedil;',   '&ccedil;',   '&#231;']
			, cedil:    ['¸',    '&cedil;',    '&cedil;',    '&#184;']
			, cent:     ['¢',    '&cent;',     '&cent;',     '&#162;']
			, Chi:      ['Χ',    '&Chi;',      '&Chi;',      '&#935;']
			, chi:      ['χ',    '&chi;',      '&chi;',      '&#967;']
			, circ:     ['ˆ',    '&circ;',     '&circ;',     '&#710;']
			, clubs:    ['♣',    '&clubs;',    '&clubs;',    '&#9827;']
			, cong:     ['≅',    '&cong;',     '&cong;',     '&#8773;']
			, 'combining acute accent':
			            [String.fromCharCode(769),
			                     '&#769;',     '&#769;',     '&#769;']
			, copy:     ['©',    '&copy;',     '&copy;',     '&#169;']
			, crarr:    ['↵',    '&crarr;',    '&crarr;',    '&#8629;']
			, curren:   ['¤',    '&curren;',   '&curren;',   '&#164;']
			, dagger:   ['†',    '&dagger;',   '&dagger;',   '&#8224;']
			, Dagger:   ['‡',    '&Dagger;',   '&Dagger;',   '&#8225;']
			, darr:     ['↓',    '&darr;',     '&darr;',     '&#8595;']
			, dArr:     ['⇓',    '&dArr;',     '&dArr;',     '&#8659;']
			, deg:      ['°',    '&deg;',      '&deg;',      '&#176;']
			, Delta:    ['Δ',    '&Delta;',    '&Delta;',    '&#916;']
			, delta:    ['δ',    '&delta;',    '&delta;',    '&#948;']
			, diams:    ['♦',    '&diams;',    '&diams;',    '&#9830;']
			, divide:   ['÷',    '&divide;',   '&divide;',   '&#247;']
			, Eacute:   ['É',    '&Eacute;',   '&Eacute;',   '&#201;']
			, eacute:   ['é',    '&eacute;',   '&eacute;',   '&#233;']
			, Ecirc:    ['Ê',    '&Ecirc;',    '&Ecirc;',    '&#202;']
			, ecirc:    ['ê',    '&ecirc;',    '&ecirc;',    '&#234;']
			, Egrave:   ['È',    '&Egrave;',   '&Egrave;',   '&#200;']
			, egrave:   ['è',    '&egrave;',   '&egrave;',   '&#232;']
			, empty:    ['∅',    '&empty;',    '&empty;',    '&#8709;']
			, Epsilon:  ['Ε',    '&Epsilon;',  '&Epsilon;',  '&#917;']
			, epsilon:  ['ε',    '&epsilon;',  '&epsilon;',  '&#949;']
			, equiv:    ['≡',    '&equiv;',    '&equiv;',    '&#8801;']
			, Eta:      ['Η',    '&Eta;',      '&Eta;',      '&#919;']
			, eta:      ['η',    '&eta;',      '&eta;',      '&#951;']
			, ETH:      ['Ð',    '&ETH;',      '&ETH;',      '&#208;']
			, eth:      ['ð',    '&eth;',      '&eth;',      '&#240;']
			, Euml:     ['Ë',    '&Euml;',     '&Euml;',     '&#203;']
			, euml:     ['ë',    '&euml;',     '&euml;',     '&#235;']
			, euro:     ['€',    '&euro;',     '&euro;',     '&#8364;']
			, fnof:     ['ƒ',    '&fnof;',     '&fnof;',     '&#402;']
			, frac12:   ['½',    '&frac12;',   '&frac12;',   '&#189;']
			, frac14:   ['¼',    '&frac14;',   '&frac14;',   '&#188;']
			, frac34:   ['¾',    '&frac34;',   '&frac34;',   '&#190;']
			, frasl:    ['⁄',    '&frasl;',    '&frasl;',    '&#8260;']
			, Gamma:    ['Γ',    '&Gamma;',    '&Gamma;',    '&#915;']
			, gamma:    ['γ',    '&gamma;',    '&gamma;',    '&#947;']
			, ge:       ['≥',    '&ge;',       '&ge;',       '&#8805;']
			, harr:     ['↔',    '&harr;',     '&harr;',     '&#8596;']
			, hearts:   ['♥',    '&hearts;',   '&hearts;',   '&#9829;']
			, hellip:   ['…',    '&#133;',     '&hellip;',   '&#133;']
			, Iacute:   ['Í',    '&Iacute;',   '&Iacute;',   '&#205;']
			, iacute:   ['í',    '&iacute;',   '&iacute;',   '&#237;']
			, Icirc:    ['Î',    '&Icirc;',    '&Icirc;',    '&#206;']
			, icirc:    ['î',    '&icirc;',    '&icirc;',    '&#238;']
			, iexcl:    ['¡',    '&iexcl;',    '&iexcl;',    '&#161;']
			, Igrave:   ['Ì',    '&Igrave;',   '&Igrave;',   '&#204;']
			, igrave:   ['ì',    '&igrave;',   '&igrave;',   '&#236;']
			, image:    ['ℑ',    '&image;',    '&image;',    '&#8465;']
			, infin:    ['∞',    '&infin;',    '&infin;',    '&#8734;']
			, integral: ['∫',    '&int;',      '&int;',      '&#8747;']
			, Iota:     ['Ι',    '&Iota;',     '&Iota;',     '&#921;']
			, iota:     ['ι',    '&iota;',     '&iota;',     '&#953;']
			, iquest:   ['¿',    '&iquest;',   '&iquest;',   '&#191;']
			, Iuml:     ['Ï',    '&Iuml;',     '&Iuml;',     '&#207;']
			, iuml:     ['ï',    '&iuml;',     '&iuml;',     '&#239;']
			, Kappa:    ['Κ',    '&Kappa;',    '&Kappa;',    '&#922;']
			, kappa:    ['κ',    '&kappa;',    '&kappa;',    '&#954;']
			, Lambda:   ['Λ',    '&Lambda;',   '&Lambda;',   '&#923;']
			, lambda:   ['λ',    '&lambda;',   '&lambda;',   '&#955;']
			, laquo:    ['«',    '&laquo;',    '&laquo;',    '&#171;']
			, lArr:     ['⇐',    '&lArr;',     '&lArr;',     '&#8656;']
			, larr:     ['←',    '&larr;',     '&larr;',     '&#8592;']
			, lceil:    ['⌈',    '&lceil;',    '&lceil;',    '&#8968;']
			, ldquo:    ['“',    '&#147;',     '&ldquo;',    '&#147;']
			, le:       ['≤',    '&le;',       '&le;',       '&#8804;']
			, lfloor:   ['⌊',    '&lfloor;',   '&lfloor;',   '&#8970;']
			, lowast:   ['∗',    '&lowast;',   '&lowast;',   '&#8727;']
			, loz:      ['◊',    '&loz;',      '&loz;',      '&#9674;']
			, lsaquo:   ['‹',    '&lsaquo;',   '&lsaquo;',   '&#8249;']
			, lsquo:    ['‘',    '&#145;',     '&lsquo;',    '&#145;']
			, macr:     ['¯',    '&macr;',     '&macr;',     '&#175;']
			, mdash:    ['—',    '&#151;',     '&mdash;',    '&#8212;']
			, micro:    ['µ',    '&micro;',    '&micro;',    '&#181;']
			, middot:   ['·',    '&middot;',   '&middot;',   '&#183;']
			, minus:    ['−',    '&minus;',    '&minus;',    '&#8722;']
			, Mu:       ['Μ',    '&Mu;',       '&Mu;',       '&#924;']
			, mu:       ['μ',    '&mu;',       '&mu;',       '&#956;']
			, nbsp:     [String.fromCharCode(160),
			                     '&nbsp;',     '&nbsp;',     '&#160;']
			, ndash:    ['–',    '&#150;',     '&ndash;',    '&#8211;']
			, ne:       ['≠',    '&ne;',       '&ne;',       '&#8800;']
			, not:      ['¬',    '&not;',      '&not;',      '&#172;']
			, notin:    ['∉',    '&notin;',    '&notin;',    '&#8713;']
			, nsub:     ['⊄',    '&nsub;',     '&nsub;',     '&#8836;']
			, Ntilde:   ['Ñ',    '&Ntilde;',   '&Ntilde;',   '&#209;']
			, ntilde:   ['ñ',    '&ntilde;',   '&ntilde;',   '&#241;']
			, Nu:       ['Ν',    '&Nu;',       '&Nu;',       '&#925;']
			, nu:       ['ν',    '&nu;',       '&nu;',       '&#957;']
			, num:      ['№',    '&#8470;',    '&#8470;',    '&#8470;']
			, Oacute:   ['Ó',    '&Oacute;',   '&Oacute;',   '&#211;']
			, oacute:   ['ó',    '&oacute;',   '&oacute;',   '&#243;']
			, Ocirc:    ['Ô',    '&Ocirc;',    '&Ocirc;',    '&#212;']
			, ocirc:    ['ô',    '&ocirc;',    '&ocirc;',    '&#244;']
			, OElig:    ['Œ',    '&OElig;',    '&OElig;',    '&#338;']
			, oelig:    ['œ',    '&oelig;',    '&oelig;',    '&#339;']
			, Ograve:   ['Ò',    '&Ograve;',   '&Ograve;',   '&#210;']
			, ograve:   ['ò',    '&ograve;',   '&ograve;',   '&#242;']
			, oline:    ['‾',    '&oline;',    '&oline;',    '&#8254;']
			, Omega:    ['Ω',    '&Omega;',    '&Omega;',    '&#937;']
			, omega:    ['ω',    '&omega;',    '&omega;',    '&#969;']
			, Omicron:  ['Ο',    '&Omicron;',  '&Omicron;',  '&#927;']
			, omicron:  ['ο',    '&omicron;',  '&omicron;',  '&#959;']
			, ordf:     ['ª',    '&ordf;',     '&ordf;',     '&#170;']
			, ordm:     ['º',    '&ordm;',     '&ordm;',     '&#186;']
			, Oslash:   ['Ø',    '&Oslash;',   '&Oslash;',   '&#216;']
			, oslash:   ['ø',    '&oslash;',   '&oslash;',   '&#248;']
			, Otilde:   ['Õ',    '&Otilde;',   '&Otilde;',   '&#213;']
			, otilde:   ['õ',    '&otilde;',   '&otilde;',   '&#245;']
			, otimes:   ['⊗',    '&otimes;',   '&otimes;',   '&#8855;']
			, Ouml:     ['Ö',    '&Ouml;',     '&Ouml;',     '&#214;']
			, ouml:     ['ö',    '&ouml;',     '&ouml;',     '&#246;']
			, para:     ['¶',    '&para;',     '&para;',     '&#182;']
			, part:     ['∂',    '&part;',     '&part;',     '&#8706;']
			, permil:   ['‰',    '&permil;',   '&permil;',   '&#8240;']
			, Phi:      ['Φ',    '&Phi;',      '&Phi;',      '&#934;']
			, phi:      ['φ',    '&phi;',      '&phi;',      '&#966;']
			, Pi:       ['Π',    '&Pi;',       '&Pi;',       '&#928;']
			, pi:       ['π',    '&pi;',       '&pi;',       '&#960;']
			, piv:      ['ϖ',    '&piv;',      '&piv;',      '&#982;']
			, plusmn:   ['±',    '&plusmn;',   '&plusmn;',   '&#177;']
			, pound:    ['£',    '&pound;',    '&pound;',    '&#163;']
			, prime:    ['′',    '&prime;',    '&prime;',    '&#8242;']
			, Prime:    ['″',    '&Prime;',    '&Prime;',    '&#8243;']
			, prod:     ['∏',    '&prod;',     '&prod;',     '&#8719;']
			, Psi:      ['Ψ',    '&Psi;',      '&Psi;',      '&#936;']
			, psi:      ['ψ',    '&psi;',      '&psi;',      '&#968;']
			, radic:    ['√',    '&radic;',    '&radic;',    '&#8730;']
			, raquo:    ['»',    '&raquo;',    '&raquo;',    '&#187;']
			, rarr:     ['→',    '&rarr;',     '&rarr;',     '&#8594;']
			, rceil:    ['⌉',    '&rceil;',    '&rceil;',    '&#8969;']
			, rdquo:    ['”',    '&#148;',     '&rdquo;',    '&#8221;']
			, real:     ['ℜ',    '&real;',     '&real;',     '&#8476;']
			, reg:      ['®',    '&reg;',      '&reg;',      '&#174;']
			, rfloor:   ['⌋',    '&rfloor;',   '&rfloor;',   '&#8971;']
			, Rho:      ['Ρ',    '&Rho;',      '&Rho;',      '&#929;']
			, rho:      ['ρ',    '&rho;',      '&rho;',      '&#961;']
			, rur:      ['₽',    '₽',          '₽',          '&#8381;']
			, rsaquo:   ['›',    '&rsaquo;',   '&rsaquo;',   '&#8250;']
			, rsquo:    ['’',    '&#146;',     '&rsquo;',    '&#146;']
			, sbquo:    ['‚',    '&sbquo;',    '&sbquo;',    '&#8218;']
			, Scaron:   ['Š',    '&Scaron;',   '&Scaron;',   '&#352;']
			, scaron:   ['š',    '&scaron;',   '&scaron;',   '&#353;']
			, sdot:     ['⋅',    '&sdot;',     '&sdot;',     '&#8901;']
			, sect:     ['§',    '&sect;',     '&sect;',     '&#167;']
			, shy:      [/*'­'*/String.fromCharCode(173),
			                     '&shy;',      '&shy;',      '&#173;']
			, Sigma:    ['Σ',    '&Sigma;',    '&Sigma;',    '&#931;']
			, sigma:    ['σ',    '&sigma;',    '&sigma;',    '&#963;']
			, sigmaf:   ['ς',    '&sigmaf;',   '&sigmaf;',   '&#962;']
			, spades:   ['♠',    '&spades;',   '&spades;',   '&#9824;']
			, sum:      ['∑',    '&sum;',      '&sum;',      '&#8721;']
			, sup1:     ['¹',    '&sup1;',     '&sup1;',     '&#185;']
			, sup2:     ['²',    '&sup2;',     '&sup2;',     '&#178;']
			, sup3:     ['³',    '&sup3;',     '&sup3;',     '&#179;']
			, szlig:    ['ß',    '&szlig;',    '&szlig;',    '&#223;']
			, Tau:      ['Τ',    '&Tau;',      '&Tau;',      '&#932;']
			, tau:      ['τ',    '&tau;',      '&tau;',      '&#964;']
			, Theta:    ['Θ',    '&Theta;',    '&Theta;',    '&#920;']
			, theta:    ['θ',    '&theta;',    '&theta;',    '&#952;']
			, thetasym: ['ϑ',    '&thetasym;', '&thetasym;', '&#977;']
			, THORN:    ['Þ',    '&THORN;',    '&THORN;',    '&#222;']
			, thorn:    ['þ',    '&thorn;',    '&thorn;',    '&#254;']
			, tilde:    ['˜',    '&tilde;',    '&tilde;',    '&#732;']
			, times:    ['×',    '&times;',    '&times;',    '&#215;']
			, trade:    ['™',    '&trade;',    '&trade;',    '&#8482;']
			, Uacute:   ['Ú',    '&Uacute;',   '&Uacute;',   '&#218;']
			, uacute:   ['ú',    '&uacute;',   '&uacute;',   '&#250;']
			, uarr:     ['↑',    '&uarr;',     '&uarr;',     '&#8593;']
			, uArr:     ['⇑',    '&uArr;',     '&uArr;',     '&#8657;']
			, Ucirc:    ['Û',    '&Ucirc;',    '&Ucirc;',    '&#219;']
			, ucirc:    ['û',    '&ucirc;',    '&ucirc;',    '&#251;']
			, Ugrave:   ['Ù',    '&Ugrave;',   '&Ugrave;',   '&#217;']
			, ugrave:   ['ù',    '&ugrave;',   '&ugrave;',   '&#249;']
			, uml:      ['¨',    '&uml;',      '&uml;',      '&#168;']
			, upsih:    ['ϒ',    '&upsih;',    '&upsih;',    '&#978;']
			, Upsilon:  ['Υ',    '&Upsilon;',  '&Upsilon;',  '&#933;']
			, upsilon:  ['υ',    '&upsilon;',  '&upsilon;',  '&#965;']
			, Uuml:     ['Ü',    '&Uuml;',     '&Uuml;',     '&#220;']
			, uuml:     ['ü',    '&uuml;',     '&uuml;',     '&#252;']
			, weierp:   ['℘',    '&weierp;',   '&weierp;',   '&#8472;']
			, Xi:       ['Ξ',    '&Xi;',       '&Xi;',       '&#926;']
			, xi:       ['ξ',    '&xi;',       '&xi;',       '&#958;']
			, Yacute:   ['Ý',    '&Yacute;',   '&Yacute;',   '&#221;']
			, yacute:   ['ý',    '&yacute;',   '&yacute;',   '&#253;']
			, yen:      ['¥',    '&yen;',      '&yen;',      '&#165;']
			, yuml:     ['ÿ',    '&yuml;',     '&yuml;',     '&#255;']
			, Yuml:     ['Ÿ',    '&Yuml;',     '&Yuml;',     '&#376;']
			, Zeta:     ['Ζ',    '&Zeta;',     '&Zeta;',     '&#918;']
			, zeta:     ['ζ',    '&zeta;',     '&zeta;',     '&#950;']
		}
	}
};


reformator.typograph = {

	process: function(text, params){
		this.text = text;
		if(text){
			if(!this.inited){
				this.init('');
			}
			this.text = '\x0A' + this.text + '\x0A';

			this.init_params(params);

			this.cut_html();

			this.init_params_by_language(params);

			this.pre_process();

			this.open_nobr();

			this.place_nbsp();

			this.dash_process();

			if(this.params.quotation_marks_a && !this.params.preserve_original_quotation){
				this.place_quotation(this.params.quotation_marks_a, this.params.quotation_marks_b);
			}

			this.post_process();

			this.return_html();

			this.close_nobr();
			this.replace('(^\\n|\\n$)', 'g', '');
		}
		return this.text;
	},


	init_params: function(params){
		this.params = {
			entity_type: 0,
			entity_type_for_nbsp: 1,
			entity_type_for_shy: 1,
			entity_type_for_special: 1,

			preserve_original_nbsp: false,
			symbols_number_for_nbsp: 2,

			collapse_09: false,
			collapse_20: true,
			collapse_0A: true,

			replace_copy: true,
			replace_plusmn: true,
			replace_reg: true,
			replace_trade: true,
			replace_times: true,
			replace_hellip: false,

			no_tags: false,

			preserve_original_nobr: false,
			symbols_number_for_nobr: 2,
			nobr: true,
			nobr_phone: true,

			preserve_original_minus: false,

			preserve_original_quotation: false
		};
		if(params){
			for(var s in params){
				if(params.constructor.prototype[s]) continue;
				this.params[s] = params[s];
			}
		}
	},


	cut_html: function(){
		var t = this;
		var s;
		this.tags = [];
		this.tag_counter = 0;

		// add spaces between end and begin some tags
		this.replace('(</[a-z][a-z\\d]*>)(?=<(?:p|h[1-6]|div|li|dd|pre|[hb]r|blockquote|address|fieldset|t[dh]|form|section|header|footer|article|aside|figure|dialog|video|audio|menu|details)(?:\\s+[^>]*)?>)', 'gi', '$1 ');

		// cut comments
		this.replace('(<(?:\\!--(?:.|\\n)*?--|%(?:.|\\n)*?%)>)', 'gi', function(str, s1){t.tags[t.tag_counter] = s1; var s = t.p.tag_begin + t.tag_counter + t.p.tag_end; t.tag_counter++; return s;});

		// cut code tags with content
		this.replace_cyclic('(<(style|script|code|var|samp)(\\s[^>]*)?>(?:.|\\n)*?<\\/\\2>)', 'gi', function(str, s1){t.tags[t.tag_counter] = s1; var s = t.p.tag_begin + t.tag_counter + t.p.tag_end; t.tag_counter++; return s;});

		// remove nobr
		if(this.params.nobr && !this.params.preserve_original_nobr){
			this.replace('<nobr(?:\\s+[^>]*)?>', 'g', '');
		}
		this.replace('<\\/nobr>', 'g', '');

		// cut opened block tags without \n before
		this.replace('([^\\n])(<([a-z]+)([^>]*)?>)', 'gi', function(str, s1, s2, s3){var s = (reformator.html.tags.all[s3] && reformator.html.tags.all[s3].block) || s3 == 'br' ? '\x0A' : ''; t.tags[t.tag_counter] = s + s2; s = s1 + s + t.p.tag_begin + t.tag_counter + t.p.tag_end; t.tag_counter++; return s;});

		// cut others
		this.replace('((<[!?\\/a-z][^>]*>)+)', 'gi', function(str, s1){t.tags[t.tag_counter] = s1; var s = t.p.tag_begin + t.tag_counter + t.p.tag_end; t.tag_counter++; return s;});

		this.text = reformator.html.replace_entities(this.text);
		this.text = reformator.html.replace_entities(this.text, {group: 'special'});

		// cut entities
		this.replace('((?:&#\\d+;\\s*)+)', 'g', function(str, s1){t.tags[t.tag_counter] = s1; var s = t.p.tag_begin + t.tag_counter + t.p.tag_end; t.tag_counter++; return s;});

		return;
	},


	init_params_by_language: function(params){
		var language = this.params.language ? this.params.language : reformator.language.get(this.text);

		switch(language){
			case 'cyr': case 'ru': case 'be': case 'uk': case 'bg': case 'lv': case 'kk': case 'mo': case 'ky': case 'os': case 'tg':
				// Russian Belarusian Ukrainian Bulgarian Latvian Kazakh Moldavian Kirghiz Ossetic Tajik
				this.params.quotation_marks_a = 'laquo raquo'; // « »
				this.params.quotation_marks_b = 'bdquo ldquo'; // „ “
				break;
			case 'fr': case 'pt': case 'es': case 'el': case 'ca':
				// French Portuguese Spanish Greek Catalan
				this.params.quotation_marks_a = 'laquo raquo'; // « »
				this.params.quotation_marks_b = 'ldquo rdquo'; // “ ”
				break;
			case 'sq': case 'it': case 'tr':
				// Albanian Italian Turkish
				this.params.quotation_marks_a = 'laquo raquo';   // « »
				this.params.quotation_marks_b = 'lsaquo rsaquo'; // ‹ ›
				break;
			case 'cs': case 'lt': case 'sk': case 'sl': case 'ro': case 'pl': case 'nl': case 'et': case 'hr':
				// Czech Lithuanian Slovak Slovene Romanian Polish Netherland Estonian Croatian
				this.params.quotation_marks_a = 'bdquo rdquo'; // „ ”
				this.params.quotation_marks_b = 'sbquo rsquo'; // ‚ ’
				break;
			case 'de': case 'da':
				// German Danish
				this.params.quotation_marks_a = 'raquo laquo';   // » «
				this.params.quotation_marks_b = 'rsaquo lsaquo'; // › ‹
				break;
			case 'hu':
				// Hungarian
				this.params.quotation_marks_a = 'bdquo rdquo'; // „ ”
				this.params.quotation_marks_b = 'raquo laquo'; // » «
				break;
			case 'no':
				// Norwegian
				this.params.quotation_marks_a = 'laquo raquo'; // « »
				this.params.quotation_marks_b = 'rsquo rsquo'; // ’ ’
				break;
			case 'fi': case 'sv':
				// Finnish Swedish
				this.params.quotation_marks_a = 'rdquo rdquo'; // ” ”
				this.params.quotation_marks_b = 'rsquo rsquo'; // ’ ’
				break;
			case 'lat': case 'en': case 'eo': case 'ga': case 'id': case 'ko': case 'th': case 'zh':
				// English Esperanto Irish Indonesian Korean Thai Chinese
				this.params.quotation_marks_a = 'ldquo rdquo'; // “ ”
				this.params.quotation_marks_b = 'lsquo rsquo'; // ‘ ’
				break;
		}
	// to do: 
	// en
	// double space after ! and ?
	// 	. and , inside quotes

	// fr
	// La, Le, L if next in upper case

	// fr
	// space before : ; ! ?
	// elki with space
		if(params){
			for(var s in params){
				if(params.constructor.prototype[s]) continue;
				this.params[s] = params[s];
			}
		}
	},


	pre_process: function(){
		// replace quots
		if(this.params.quotation_marks_a && !this.params.preserve_original_quotation){
			//this.replace('[\xC2\x92‘’′]', 'g', '\'');
			this.replace('[″«»“”„‹›]', 'g', '"');
		}

		// replace nbsp
		if(!this.params.preserve_original_nbsp){
			this.replace(this.e.nbsp[0], 'g', '\x20');
		}

		// replace dash
		if(!this.params.preserve_original_minus){
			this.replace('([\xC2\x96\xC2\x97–—]|(^|[^-])--(?!\\s*-))', 'g', '$2—');
		}

		// replace spaces
		if(this.params.collapse_09){
			this.replace('\\x09+', 'g', '\x20');
		}
		if(this.params.collapse_20){
			this.replace('\x20{2,}', 'g', '\x20');
			//this.replace('((^|\\n)'+ this.p.tag + ')\x20+', 'g', '$1');
			this.replace('(^|\\n)\x20+', 'g', '$1');
		}

		// pseudo code replaces
		if(this.params.replace_plusmn){
			this.replace('\\+\\-', 'g', this.e.plusmn[0]);
		}
		if(this.params.replace_copy){
			this.replace('\\([cс]\\)', 'gi', this.e.copy[0]);
		}
		if(this.params.replace_reg){
			this.replace('\\(r\\)', 'gi', this.e.reg[0]);
		}
		if(this.params.replace_trade){
			this.replace('(\\S)\\(tm\\)', 'gi', '$1' + this.e.trade[0]);
		}
		if(this.params.replace_hellip){
			this.replace('([^\\.]|^)\\.{3,3}(?=[^\\.]|$)', 'g', '$1' + this.e.hellip[0]);
		}else{
			this.replace(this.e.hellip[0], 'g', '...');
		}
		if(this.params.replace_times){
			this.replace('(\\d' + this.p.tag + ')\x20?(' + this.p.tag + ')[xх](' + this.p.tag + ')\x20?(' + this.p.tag + '\\d)', 'g', '$1$2' + this.e.times[0]+ '$3$4');
		}

		// place apostrophe
		this.replace('(' + this.p.letters + '{2})(\')(?=' + this.p.letters + '{0,2}' + this.p.word_end_0s+ ')', 'g', '$1'+ this.e.rsquo[0]);

		// place mdash
		// -_
		this.replace('(\\n' + this.p.tag + '\\s*' + this.p.tag + '\\s*|' + this.p.sentence_end + '\x20' + this.p.tag + ')[\\-\\—](' + this.p.tag + ')\x20', 'g', '$1' + this.e.mdash[0] + '$2' + this.e.nbsp[0]);
		// _-
		this.replace('(' + this.p.letters_digits + this.p.word_end_0 + ')\x20(' + this.p.tag + ')[\\-\\—](?=' + this.p.tag + '\x20)', 'g', '$1' + this.e.nbsp[0] + '$2' + this.e.mdash[0]);
		return;
	},


	open_nobr: function(){
		var t = this;
		if(this.params.nobr && !this.params.no_tags){
			this.tag_counter.inc++;
			this.tags[this.tag_counter] = '<nobr>';
		// pochemu-to
			//this.replace('(\\s|^)(?=' + this.p.word_begin_0 + this.p.letters + '+' + this.p.tag + '[\\-\\—]' + this.p.letters + '{1,' + this.params.symbols_number_for_nobr + '}' + this.p.word_end_0s + ')', 'g', function(str, s1){return s1 + t.p.tag_begin + t.tag_counter + t.p.tag_end;});
		// po-moemu
			//this.replace('(\\s|^)(?=' + this.p.word_begin_0 + this.p.letters + '{1,this.params.symbols_number_for_nobr}[\\-\\—]\\S)', 'g', function(str, s1){return s1 + t.p.tag_begin + t.tag_counter + t.p.tag_end;});
		// ranges
			this.replace('(\\s|^)(' + this.p.word_begin_0 + '(?:' + this.p.number + '[\\-\\—]' + this.p.number + '|' + this.p.roman_number + '\\—' + this.p.roman_number + '))(?=' + this.p.word_end_0s + ')', 'gi', function(str, s1, s2){return s1 + t.p.tag_begin + t.tag_counter + t.p.tag_end + s2;});
		// numerical
			this.replace('(\\s|^)(' + this.p.word_begin_0 + '(?:' + this.p.number + '|' + this.p.roman_number + ')-' + this.p.letters + '+)(?=' + this.p.word_end_0s + ')', 'gi', function(str, s1, s2){return s1 + t.p.tag_begin + t.tag_counter + t.p.tag_end + s2;});
		}
		// phones
		if(this.params.nobr_phone && !this.params.no_tags){
			this.tag_counter++;
			this.tags[this.tag_counter] = '<nobr class="phone">';
		// to do: +44 20 1234 1234
			var r = this.make_regular_expression('(\\d\\-\\d+\\-\\d|\\+(?:\\d\x20?){11})');
			this.replace('(\\s|^)(' + this.p.word_begin_0 + '\\+?(?:\\d(?:[\\-\\\x28\\\x29\x20]*|' + this.p.tag + ')){5,11})(?=' + this.p.word_end_0s + ')', 'g', function(str, s1, s2){return s1 + (s2.match(r) ? t.p.tag_begin + t.tag_counter + t.p.tag_end + s2.replace(/\x20/g, t.e.nbsp[0]) : s2);});
		}
		return;
	},


	place_nbsp: function(){
		var t = this;
		// 5_000_000
		// to do: limit on length
		this.replace('(\\d' + this.p.tag + ')\x20(?=' + this.p.tag + '\\d{3}' + this.p.word_end_0s + ')', 'g', '$1' + this.e.nbsp[0]);

		// exceptions
		this.replace('(\\S)\x20(?=' + this.p.word_begin_0 + this.p.exceptions_left + this.p.word_end_0s + ')', 'g', '$1&_;');
		//this.replace('(\\S)\x20(?=' + this.p.exceptions_left + '\\s)', 'g', '$1&_;');

		// No_1
		this.replace('([№§]' + this.p.tag + ')\x20?(?=' + this.p.tag + '(?:' + this.p.number + '|' + this.p.roman_number + '))', 'g', '$1' + this.e.nbsp[0]);

		// bla_/ bla
		this.replace('\x20([\\/\\|])\x20', 'g', this.e.nbsp[0] + '$1\x20');

		// 600_rubley, 500_GHz or 200_km or 60_km/h 
		this.replace('((?:' + this.p.number + '|' + this.p.roman_number + ')' + this.p.nulls + ')\x20(?=' + this.p.tag + '(' + this.p.letters + '+' + this.p.word_end_1s + '|' + this.p.letters_upper + '{2}|' + this.p.letters + '+\\/|(?!' + this.p.exceptions_right + this.p.word_end_0s + ')' + this.p.letters + '{1,' + this.params.symbols_number_for_nbsp + '}' + this.p.word_end_0s + '))', 'g', '$1&_;');

		// Usome 1, Usome 1 Usome
		this.replace('(' + this.p.word_begin_0s + this.p.letters_upper + this.p.letters_lower + '*' + this.p.nulls + ')\x20(?=' + this.p.nulls+ '\\d{1,' + this.params.symbols_number_for_nbsp + '}(?:' + this.p.word_end_1 + '|' + this.p.word_begin_0s + this.p.letters_upper +'))', 'g', '$1&_;');

		// lower_U lower or lower_l.
		this.replace('(' + this.p.word_begin_0s + this.p.letters_lower + '+' + this.p.nulls + ')\x20(?=' + this.p.nulls + '(?:' + this.p.letters_upper + this.p.letters + '{0,' + (this.params.symbols_number_for_nbsp - 1) + '}' + this.p.word_end_s + '(?=' + this.p.tag + this.p.letters_lower + ')|' + this.p.letters_lower + '{1,' + this.params.symbols_number_for_nbsp + '}(?:' + this.p.word_end_1s + '|' + this.p.word_begin_2s + ')))', 'g', '$1&_;');

		// some_s ( or some_s, lower
		this.replace('(' + this.p.word_begin_0s + this.p.letters_digits + '+' + this.p.nulls + ')\x20(?=' + this.p.nulls + '(?:' + this.p.letters_digits + '{1,' + this.params.symbols_number_for_nbsp + '}(?:' + this.p.word_end_0s + '$|' + this.p.word_begin_2s + '|' + this.p.word_end_1s + this.p.word_begin_0 + this.p.letters_lower + ')))', 'g', '$1&_;');

		// Lastname_F._M.
		this.replace('(' + this.p.letters_upper + this.p.letters_lower + '+' + this.p.nulls + ')\x20(' + this.p.tag + this.p.letters_upper + this.p.nulls + '\\.' + this.p.nulls + ')(?:\x20(' + this.p.tag + this.p.letters_upper + this.p.nulls + '\\.' + this.p.nulls + '))?(?=' + this.p.word_end_1s + '|' + this.p.tag + '(?:\\s*\\n|\\s' + this.p.word_begin_0 + this.p.letters_lower + '))', 'g', function(str, s1, s2, s3){return s1 + '&_;' + s2 +(s3 ? '&_;' + s3: '');});

		// common nbsp
		//this.replace('(?<=\\s|' + this.e.nbsp[0] + ')(' + this.p.word_begin_0 + this.p.letters_digits + '{1,' + this.params.symbols_number_for_nbsp + '}(?!(?<=\\d)' + this.p.nulls + '\x20' + this.p.word_begin_0 + '\\d)' + this.p.nulls + ')\x20(?=' + this.p.word_begin_0 + this.p.letters_digits + ')', 'g', '$1' + this.e.nbsp[0]);
		this.replace_cyclic('(' + this.p.word_begin_0s + this.p.letters_digits + '{0,' + (this.params.symbols_number_for_nbsp - 1) + '}(?!\\d' + this.p.nulls + '\x20' + this.p.word_begin_0 + '\\d)' + this.p.letters_digits + this.p.nulls + ')\x20(?=' + this.p.word_begin_0 + this.p.letters_digits + ')', 'g', '$1' + this.e.nbsp[0]);

		// F._M._Lastname
		this.replace('((?:\\n\\s*|' + this.p.not_letters_upper + this.p.word_end_1s + '|' + this.p.word_begin_1 + '|' + this.p.word_begin_0s + this.p.letters_lower + '+' + this.p.word_end_0s + ')' + this.p.word_begin_0 + this.p.letters_upper + this.p.nulls + '\\.' + this.p.nulls + ')\x20(?:(' + this.p.tag + this.p.letters_upper + this.p.nulls + '\\.' + this.p.nulls + ')\x20)?(' + this.p.tag + this.p.letters_upper + this.p.letters_lower + '+)', 'g', function(str, s1, s2, s3){return s1 + t.e.nbsp[0] + (s2 ? s2 + t.e.nbsp[0]: '') + s3;});
		//^self.replace[((?:${self.p.not_letters_upper}${self.p.word_end_1s}|${self.p.word_begin_1}|${self.p.word_begin_0s}${self.p.letters_lower}+${self.p.word_end_0s})${self.p.word_begin_0}${self.p.letters_upper}${self.p.nulls}\.${self.p.nulls})^#20(?:(${self.p.tag}${self.p.letters_upper}${self.p.nulls}\.${self.p.nulls})^#20)?(${self.p.tag}${self.p.letters_upper}${self.p.letters_lower}+)][g]{${match.1}${self.e.nbsp.0}^if(def ${match.2}){${match.2}${self.e.nbsp.0}}${match.3}}


		// others
		this.replace('&_;', 'g', this.e.nbsp[0]);

		// L._L. or L._LL.
		this.replace('(' + this.p.letters_upper + this.p.nulls + '\\.' + this.p.nulls + ')\x20(?=' + this.p.tag + this.p.letters_upper + '{1,' + this.params.symbols_number_for_nbsp + '}\\.)', 'g', '$1' + this.e.nbsp[0]);
		// l._l, or l._l. or l. 1.
		this.replace('(' + this.p.letters_lower + this.p.nulls + '\\.' + this.p.nulls + ')\x20(?=' + this.p.tag + '(?:' + this.p.letters_lower + '{1,' + this.params.symbols_number_for_nbsp + '}|' + this.p.number + ')(?:' + this.p.word_end_1 + '|' + this.p.nulls + '(?:\\s|$)))', 'g', '$1' + this.e.nbsp[0]);

		return;
	},


	dash_process: function(){
		// place ndash in numbers range
		this.replace('((?:^|\\s|' + this.e.nbsp[0] + ')' + this.p.word_begin_0 + '\\$?' + this.p.number + this.p.tag + ')\\—(?=' + this.p.tag + this.p.number + '(?:' + this.p.word_end_0s + '|-' + this.p.letters + '{1,2}' + this.p.word_end_0s + '))', 'g', '$1' + this.e.ndash[0]);
		this.replace('((?:^|\\s|' + this.e.nbsp[0] + ')' + this.p.word_begin_0 + this.p.roman_number + this.p.tag + ')\\—(?=' + this.p.tag + this.p.roman_number + '(?:' + this.p.word_end_0s + '|-' + this.p.letters + '{1,2}' + this.p.word_end_0s + '))', 'g', '$1' + this.e.ndash[0]);

		// place minus
		this.replace('(\x20|' + this.e.nbsp[0] + ')(?:' + this.p.tag + ')-(\\d)', 'gi', '$1' + this.e.minus[0] + '$2');

		// &nbsp;&mdash;&nbsp;as -> &nbsp;&mdash; as&nbsp;
		this.replace('(' + this.e.nbsp[0] + this.e.mdash[0] + ')' + this.e.nbsp[0], 'g', '$1\x20');
		return;
	},


	place_quotation: function(a, b){
		var t, LQ, RQ, Lq, Rq;

		t = a.split(' ');
		LQ = this.e[t[0]][0];
		RQ = this.e[t[1]][0];
		if(t[0] != 'quot' && t[1] != 'quot'){
			this.replace_cyclic('(' + this.p.word_begin_0s + '|[-\\.])(")((?!' + this.p.tag + '(?:\\s|' + this.e.nbsp[0] + '))[^"]{1,1900}?(?!(?:\\s|' + this.e.nbsp[0] + ')' + this.p.tag + ')[^"]{0,100})\\2(?=' + this.p.tag + '(?:' + this.p.word_end_1s + '|' + this.p.word_end_0s + '|[-\\*]|' + this.p.tag_1 + '\\d' + this.p.tag_1 + '))', 'g', '$1' + LQ + '$3' + RQ);
		}

		t = b.split(' ');
		Lq = this.e[t[0]][0];
		Rq = this.e[t[1]][0];
		if(LQ != Lq && RQ != Rq){
			this.replace_cyclic('(' + LQ + '[^' + LQ + RQ + ']{0,2000})' + LQ + '([^' + LQ + RQ + ']{0,2000})' + RQ, 'g', '$1' + Lq + '$2' + Rq);
		}

		// <Company <Some>
		this.replace('"(\\S[^"' + LQ + Lq + RQ + Rq + ']*)([' + LQ + Lq + '])', 'g', '$2$1$2');
		return;
	},


	post_process: function(){
		// to do: 
		// place prime
		this.replace('(\\d\\s*)(\')(?=' + this.p.word_end_0s + ')', 'g', '$1' + this.e.prime[0]);
		this.replace('(\\d\\s*)(\\")(?=' + this.p.word_end_0s + ')', 'g', '$1' + this.e.Prime[0]);
		this.replace('\\\'', 'g', this.e.rsquo[0]);
		return;
	},


	return_html: function(){
		this.text = reformator.html.replace_entities(this.text, {type: this.params.entity_type_for_special, group: 'special'});
		this.text = reformator.html.replace_entities(this.text, {type: this.params.entity_type});
		if(this.params.entity_type != this.params.entity_type_for_nbsp){
			this.replace(this.e.nbsp[this.params.entity_type], 'g', this.e.nbsp[this.params.entity_type_for_nbsp]);
		}
		if(this.params.entity_type != this.params.entity_type_for_shy){
			this.replace(this.e.shy[this.params.entity_type], 'g', this.e.shy[this.params.entity_type_for_shy]);
		}

		if(!this.params.no_tags){
			var t = this;
			this.replace_cyclic('(\x0A?)' + this.p.tag_begin + '(\\d+)' + this.p.tag_end, 'g', function(str, s1, s2){var s = t.tags[s2]; return s.indexOf('\x0A') == 0 ? s.substr(1) : s1 + s});
			this.replace('(<sup(\\s[^>]*)?>' + this.e.reg[this.params.entity_type] + '(\\s+|' + this.e.nbsp[this.params.entity_type_for_nbsp] + ')?</sup>|' + this.e.reg[this.params.entity_type] + ')', 'g', '<sup class="reg">' + this.e.reg[this.params.entity_type] + '</sup>$3');
		}else{
		// to do: replace on html:tags.all.block
			this.replace_cyclic(this.p.tag_begin + '(\\d+)' + this.p.tag_end, 'g', function(str, s1){return t.tags[s1];});
		}
		return;
	},


	close_nobr: function(){
		if(!this.params.no_tags){
			this.replace_cyclic('(<nobr[^>]*>(?!<nobr))(<(\\/?\\w+)(\\s+[^>]*)*>)(?![^\\s]*</\\3>)', 'g', '$2$1');
			this.replace_cyclic('(<nobr[^>]*>)(<nobr[^>]*>)', 'g', '$1');
			this.replace('(<nobr[^>]*>(?:<(\\w+)(?:\\s+[^>]*)*>(?:.|\n)*?</\\2>|\\s*<[a-z][^>]*\\/>\\s*|[^<\\s]+?)+)(<[a-z][^>]*\\/>)?', 'g', '$1</nobr>$3');
			this.replace_cyclic('(<nobr[^>]*>)(<(\\w+)(\\s+[^>]*)?>)(\\S*?)(</\\3>)(</nobr>)(\\s|$)', 'g', '$2$1$5$7$6$8');
			// remove nbsp from nobr and wide nobr
			var r = this.make_regular_expression('(' + this.e.nbsp[this.params.entity_type_for_nbsp] + '|<\\/?nobr[^>]*>)+', 'g');
			var r1 = this.make_regular_expression('</?[a-z][^>]*>', 'gi');
			this.replace('(<nobr[^>]*>)((?:.|\n)*?)(</nobr>)', 'g',
				function(str, s1, s2, s3){
					s2 = s2.replace(r, '\x20');
					return (s2.replace(r1, '').length < 30) ? s1 + s2 + s3 : s2;
				}
			);
			this.replace('<\\/nobr><nobr[^>]*>', 'g', '');
		}
	},


	replace_cyclic: function(pattern, options, replace_with){
		var regexp = this.make_regular_expression(pattern, options);
		while(this.text.match(regexp)){
			this.text = this.text.replace(regexp, replace_with);
		}
		return;
	},


	replace: function(pattern, options, replace_with){
		var regexp = this.make_regular_expression(pattern, options);
		this.text = this.text.replace(regexp, replace_with);
		return;
	},


	match: function(pattern, options){
		return this.text.match(this.make_regular_expression(regexp, options));
	},


	patterns: [],

	make_regular_expression: function(pattern, options){
		var id = pattern + ' ' + options;
		if(!this.patterns[id]){
			try{
				this.patterns[id] = new RegExp(pattern, options);
			}catch(error){
			}
		}
		return this.patterns[id];
	},


	init: function(){
		this.inited = true;
		if(!reformator.language.inited){
			reformator.language.init();
		}
		if(!reformator.html.inited){
			reformator.html.init();
		}

		this.e = reformator.html.entities.common;

		// patterns
		this.p = {};

		// tags
		this.p.tag_begin = '\x02';
		this.p.tag_end   = '\x02';
		this.p.tag       = '(?:' + this.p.tag_begin + '\\d+' + this.p.tag_end + ')*';
		this.p.tag_1     = '(?:' + this.p.tag_begin + '\\d+' + this.p.tag_end + ')+';

		// null symbols
		this.p.nulls = this.p.tag + '(?:[ª®°¹²³´¶™+−±\\*\\/]' + this.p.tag + '){0,4}';

		// sentence encloses
		this.p.sentence_end_symbols = '\\.\\:\\;\\!\\?…';
		this.p.sentence_end = '(?:' + this.p.tag + '[' + this.p.sentence_end_symbols + ']+' + this.p.tag + ')';

		// words encloses
		this.p.word_end_s = this.p.nulls + '(?:[\\s' + this.e.nbsp[0] + ']+|$)';
		this.p.word_end   = this.p.nulls + '(?:[%\\\x29\\\x5d\\\x7d>\\,\\"' + this.p.sentence_end_symbols + ']{1,6}' + this.p.nulls + ')';
		this.p.word_end_1  = this.p.word_end + '{1,4}';
		this.p.word_end_1s = this.p.word_end_1 + this.p.word_end_s;
		this.p.word_end_0  = this.p.word_end + '{0,4}';
		this.p.word_end_0s = this.p.word_end_0 + this.p.word_end_s;

		this.p.word_begin_s  = '[\\s' + this.e.nbsp[0] + ']';
		this.p.word_begin_1  = '(?:' + this.p.nulls + '[\\\x28\\\x5b\\\x7b<\\"\°\+]{1,4}' + this.p.nulls + ')';
		this.p.word_begin_1s = this.p.word_begin_s + this.p.word_begin_1 + '{1,4}';
		this.p.word_begin_2  = '(?:' + this.p.nulls + '[\\\x28\\\x5b\\\x7b<]{1,4}' + this.p.nulls + ')';
		this.p.word_begin_2s = this.p.word_begin_s + this.p.word_begin_2 + '{1,4}';
		this.p.word_begin_0  = this.p.nulls + this.p.word_begin_1 + '?' + this.p.nulls;
		this.p.word_begin_0s = this.p.word_begin_s + this.p.word_begin_0;

		// letters

		this.p.letters_lower     = reformator.language.lower_letters + '&%©\\$€£¥¤₽' + String.fromCharCode(769);
		this.p.letters_upper     = reformator.language.upper_letters;
		this.p.not_letters_upper = '[^' + this.p.letters_upper + ']';
		this.p.letters           = this.p.letters_lower + this.p.letters_upper;
		this.p.letters_digits    = '[\\d' + this.p.letters + ']';

		this.p.letters_lower = '[' + this.p.letters_lower + ']';
		this.p.letters_upper = '[' + this.p.letters_upper + ']';
		this.p.letters       = '[' + this.p.letters + ']';

		this.p.number       = '(?:[#\\.\\,\\+\\-±−]?(?:\\d+(?:[\\.\\,\\:]\\d+)*|[¼½¾]))';
		this.p.roman_number = '(?:[IXCMVLD]+(?![ABEFGHJKNOPQRSTUWYZ]))';
		//this.p.roman_number = '(?:(?<![ABEFGHJKNOPQRSTUWYZ])[IXCMVLD]+(?![ABEFGHJKNOPQRSTUWYZ]))';

		// to do: more exceptions
		this.p.exceptions_left  = '(?:бы|б|же|ж|ли|ль|us)';
		this.p.exceptions_right = '(?:и|до|по|от|за|из|to|by|in|of)';
		return;
	}
};
