reformator.uploader = {
	submit_upload_form: function(form_element){
		form_element.submit();
		form_element.reset();
	},

	insert_img: function(iframe_element){
		if(reformator.current){
			var result = this.get_result(iframe_element);
			if(result && result.path){
				reformator.current.wysiwyg.insert('<img src="' + result.path + '"/>', null, null, false);
			}
		}
	},

	insert_a: function(iframe_element){
		if(reformator.current){
			var result = this.get_result(iframe_element);
			if(result && result.path){
				reformator.current.wysiwyg.insert('<a href="' + result.path + '">', '</a>', null, false);
			}
		}
	},

	get_result: function(iframe_element){
		var doc = iframe_element.contentDocument
			? iframe_element.contentDocument
			: (
				iframe_element.contentWindow
				? iframe_element.contentWindow.document
				: null
			);
		if(!doc || doc.location.href == 'about:blank'){
			return;
		}
		var result = doc.body.innerHTML;
		if(result){
			return eval('new Object(' + result + ')');
		}else{
			return;
		}
	}
};