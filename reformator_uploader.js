/*
 Copyright Art. Lebedev | http://www.artlebedev.ru/
 Author: Vladimir Tokmakov | vlalek
 Updated: 2017-05-19
*/

/*
	Create UPLOADER_SCRIPT which save posted file and return JSON:
	{path: 'PATH_TO_FILE'}

	Insert into sidebar.html:
	<ul class="format_group">
		<li class="text">
			<form action="UPLOADER_SCRIPT" method="post" enctype="multipart/form-data" target="upload_and_insert_img">
				Insert<br/>
				<a href="#upload_and_insert_img" class="pseudo">
					image...
					<input name="file" type="file" onchange="reformator_uploader.submit_upload_form(this.parentNode.parentNode)"/>
				</a>
			</form>
			<iframe id="upload_and_insert_img" name="upload_and_insert_img" onload="reformator_uploader.insert_img(this, parent.reformator)"></iframe>
		</li>
	</ul>
*/

var reformator_uploader = {
	submit_upload_form: function(form_element){
		form_element.submit();
		form_element.reset();
	},

	insert_img: function(iframe_element, reformator){
		if(reformator.current){
			var result = this.get_result(iframe_element);
			if(!result){return;}
			if(result.error){
				alert(result.error);
			}else if(result.path){
				reformator.current.wysiwyg.insert('<img src="' + result.path + '"/>', null, null, false);
			}
		}
	},

	insert_a: function(iframe_element, reformator){
		if(reformator.current){
			var result = this.get_result(iframe_element);
			if(!result){return;}
			if(result.error){
				alert(result.error);
			}else if(result.path){
				reformator.current.wysiwyg.insert('<a href="' + result.path + '">', '</a>', null, false);
			}
		}
	},

	insert_a_img: function(iframe_element, reformator){
		if(reformator.current){
			var result = this.get_result(iframe_element);
			if(!result){return;}
			if(result.error){
				alert(result.error);
			}else if(result.path){
				reformator.current.wysiwyg.insert('<a href="' + result.path + '"><img src="' + result.preview_path + '"/></a>', null, null, false);
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