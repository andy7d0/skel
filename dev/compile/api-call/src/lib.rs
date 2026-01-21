use swc_core::ecma::{
    ast::*,
    transforms::testing::test_inline,
    visit::{visit_mut_pass, VisitMut, VisitMutWith},
};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata, metadata::TransformPluginMetadataContextKind};
use swc_core::common::BytePos;
use swc_core::common::FileName;
use swc_core::common::DUMMY_SP;

pub struct TransformVisitor {
    source_file_path: String
}

impl TransformVisitor {
     pub fn new(filename: &String) -> Self {
        Self { source_file_path: filename.clone() }
     }    
}

impl VisitMut for TransformVisitor {
    // Implement necessary visit_mut_* methods for actual custom transform.
    // A comprehensive list of possible visitor methods can be found here:
    // https://rustdoc.swc.rs/swc_ecma_visit/trait.VisitMut.html
    fn visit_mut_tagged_tpl(&mut self, node: &mut TaggedTpl) {
        node.visit_mut_children_with(self);

        //dbg!(&*node);
        match &*node.tag {
            Expr::Member(expr) => 
                {   
                    match (&*expr.obj, &expr.prop) {
                        (Expr::Ident(id), MemberProp::Ident(prop)) 
                        if id.sym == "API" && id.optional == false
                            => { 
                                let fp = self.source_file_path.clone();
                                let BytePos(pos) = id.span.lo;

                                node.tpl.quasis[0].cooked = Some(fp.clone().into());
                                node.tpl.quasis[0].raw = fp.into();
                                node.tpl.quasis[0].tail = false;

                                node.tpl.quasis.push(TplElement{
                                    span: DUMMY_SP
                                    , tail: true
                                    , cooked: Some("".into())
                                    , raw: "".into()
                                });

                                node.tpl.exprs = vec![ Box::new(Expr::Lit((pos as f64).into())) ]                               
                            },
                        _ => (),
                    };
                }
            _ => (),
        };
    }
}

/// An example plugin function with macro support.
/// `plugin_transform` macro interop pointers into deserialized structs, as well
/// as returning ptr back to host.
///
/// It is possible to opt out from macro by writing transform fn manually
/// if plugin need to handle low-level ptr directly via
/// `__transform_plugin_process_impl(
///     ast_ptr: *const u8, ast_ptr_len: i32,
///     unresolved_mark: u32, should_enable_comments_proxy: i32) ->
///     i32 /*  0 for success, fail otherwise.
///             Note this is only for internal pointer interop result,
///             not actual transform result */`
///
/// This requires manual handling of serialization / deserialization from ptrs.
/// Refer swc_plugin_macro to see how does it work internally.
#[plugin_transform]
pub fn process_transform(mut program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let filename = if let Some(filename_str) =
        metadata.get_context(&TransformPluginMetadataContextKind::Filename)
    {
        filename_str
    } else {
        "unknown".to_string()
    };
    let mut visitor = TransformVisitor::new(&filename);
    program.visit_mut_with(&mut visitor);
    program
}

// An example to test plugin transform.
// Recommended strategy to test plugin's transform is verify
// the Visitor's behavior, instead of trying to run `process_transform` with mocks
// unless explicitly required to do so.
test_inline!(
    Default::default(),
    |_| visit_mut_pass(TransformVisitor),
    boo,
    // Input codes
    r#"console.log(API.GET` transform`);"#,
    // Output codes after transformed with plugin
    r#"console.log(API.GET`13`);"#
);