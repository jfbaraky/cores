import sys, re
from html.parser import HTMLParser

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out=[]; self.in_doc=0; self.depth=0
        self.skip=0; self.pre=False; self.line_span=0
        self.table=None; self.row=None; self.cell=None
        self.list=[]; self.href=None; self.code_lang=''
    def w(self,s):
        if self.cell is not None: self.cell.append(s)
        else: self.out.append(s)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); cls=a.get('class','') or ''
        if self.in_doc:
            self.depth+= tag not in ('br','img','hr','input','meta','link')
        if tag=='div' and 'vp-doc' in cls.split() and not self.in_doc:
            self.in_doc=1; self.depth=1; return
        if not self.in_doc: return
        if tag=='button' or (tag=='span' and 'lang' in cls.split()) or tag=='svg' or (tag=='a' and 'header-anchor' in cls) or tag=='style' or tag=='script':
            self.skip+=1; self.skip_depth=getattr(self,'skip_depth',[])+[self.depth]; return
        if self.skip: return
        if tag=='div' and cls.startswith('language-'):
            self.code_lang=cls.split()[0].replace('language-','')
        if tag in ('h1','h2','h3','h4','h5'):
            self.w('\n\n'+'#'*int(tag[1])+' ')
        elif tag=='p': self.w('\n\n')
        elif tag in ('ul','ol'): self.list.append(tag); self.w('\n')
        elif tag=='li': self.w('\n'+'  '*(len(self.list)-1)+('- ' if self.list and self.list[-1]=='ul' else '1. '))
        elif tag=='pre': self.pre=True; self.w('\n\n```'+self.code_lang+'\n')
        elif tag=='code' and not self.pre: self.w('`')
        elif tag=='strong' or tag=='b': self.w('**')
        elif tag=='em': self.w('*')
        elif tag=='a': self.href=a.get('href'); self.w('[')
        elif tag=='table': self.table=[]; 
        elif tag=='tr' and self.table is not None: self.row=[]
        elif tag in ('td','th') and self.row is not None: self.cell=[]
        elif tag=='br': self.w('\n' if not self.cell else ' ')
        elif tag=='span' and self.pre and 'line' in cls.split(): pass
        elif tag=='blockquote': self.w('\n\n> ')
        elif tag=='div' and ('custom-block' in cls):
            kind=[c for c in cls.split() if c in('tip','warning','danger','info','details')]
            self.w('\n\n> **'+(kind[0].upper() if kind else 'NOTE')+':** ')
    def handle_endtag(self,tag):
        if not self.in_doc: return
        if self.skip:
            if getattr(self,'skip_depth',[]) and self.skip_depth[-1]==self.depth:
                self.skip_depth.pop(); self.skip-=1
            self.depth-=1; return
        if tag in ('h1','h2','h3','h4','h5'): self.w('\n')
        elif tag in ('ul','ol'):
            if self.list: self.list.pop()
            self.w('\n')
        elif tag=='pre': self.pre=False; self.w('\n```\n')
        elif tag=='code' and not self.pre: self.w('`')
        elif tag in('strong','b'): self.w('**')
        elif tag=='em': self.w('*')
        elif tag=='a':
            self.w(']('+(self.href or '')+')') if self.href and not self.href.startswith('#') else self.w(']' if False else '')
            if self.href and self.href.startswith('#'): pass
        elif tag in('td','th') and self.cell is not None:
            self.row.append(''.join(self.cell).strip().replace('\n',' ').replace('|','\\|')); self.cell=None
        elif tag=='tr' and self.row is not None:
            self.table.append(self.row); self.row=None
        elif tag=='table' and self.table is not None:
            t=self.table
            if t:
                n=max(len(r) for r in t)
                rows=[r+['']*(n-len(r)) for r in t]
                self.out.append('\n\n| '+' | '.join(rows[0])+' |\n|'+'---|'*n+'\n')
                for r in rows[1:]: self.out.append('| '+' | '.join(r)+' |\n')
            self.table=None
        elif tag=='span' and self.pre:
            pass
        self.depth-=1
        if tag=='div' and self.depth==0: self.in_doc=0
    def handle_data(self,d):
        if not self.in_doc or self.skip: return
        if self.pre:
            self.w(d)
        else:
            d=re.sub(r'\s+',' ',d)
            self.w(d)

def conv(path):
    p=P(); p.feed(open(path,encoding='utf-8').read())
    s=''.join(p.out)
    s=re.sub(r'\n{3,}','\n\n',s)
    s=re.sub(r'```(\w*)\n\n+',r'```\1\n',s)
    return s.strip()+'\n'
if __name__=='__main__':
    print(conv(sys.argv[1]))
