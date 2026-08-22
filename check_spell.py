#!/usr/bin/env python3
import re

def check_spell():
    # Load dictionary
    with open('/usr/share/dict/words', 'r') as f:
        valid_words = set(word.strip().lower() for word in f)
        
    # Add some common words/names that might not be in the dict
    extra_words = {'online', 'startup', 'blog', 'podcast', 'email', 'internet', 'website',
                   'instagram', 'twitter', 'facebook', 'linkedin', 'tiktok', 'youtube',
                   'iphone', 'ipad', 'macbook', 'powerpoint', 'google', 'amazon', 'netflix',
                   'nfl', 'nba', 'ceo', 'robert', 'greene', 'ryan', 'holiday', 'stoicism',
                   'stoic', 'epictetus', 'seneca', 'marcus', 'aurelius', 'ferriss', 'tim',
                   'sivers', 'derek', 'mckeown', 'greg', 'clear', 'james', 'manson', 'mark',
                   'housel', 'morgan', 'attia', 'peter', 'walker', 'matthew', 'dalio', 'ray',
                   'newport', 'cal', 'gottman', 'john', 'zraly', 'kevin', 'abdaal', 'ali',
                   'kahneman', 'daniel', 'frankl', 'viktor', 'csikszentmihalyi', 'mihaly',
                   'taleb', 'nassim', 'gladwell', 'malcolm', 'kaufman', 'josh', 'rubin', 'gretchen',
                   'sinek', 'simon', 'pink', 'daniel', 'godin', 'seth', 'kondo', 'marie',
                   'kierkegaard', 'soren', 'nietzsche', 'friedrich', 'schopenhauer', 'arthur',
                   'kahneman', 'tversky', 'amos', 'thaler', 'richard', 'ariely', 'dan',
                   'berkshire', 'hathaway', 'buffett', 'warren', 'munger', 'charlie',
                   'dopamine', 'serotonin', 'endorphins', 'oxytocin', 'cortisol', 'testosterone',
                   'estrogen', 'progesterone', 'insulin', 'glucagon', 'glycogen', 'glucose',
                   'fructose', 'sucrose', 'lactose', 'galactose', 'maltose', 'amylose', 'amylopectin',
                   'cholesterol', 'triglycerides', 'lipoproteins', 'apolipoprotein', 'mTOR', 'rDNA',
                   'HbA1c', 'apoB', 'mg/dL', 'Lp(a)', 'LDL', 'HDL', 'VLDL', 'CVD', 'ASCVD', 'SAD',
                   'DNA', 'RNA', 'ATP', 'AMPK', 'NAD', 'NMN', 'NR', 'NAD+', 'NADH', 'SIRT', 'SIRT1',
                   'hypertrophy', 'cardiovascular', 'aerobic', 'anaerobic', 'vo2', 'vo2max', 'max',
                   'metabolic', 'metabolism', 'mitochondria', 'mitochondrial', 'autophagy', 'apoptosis',
                   'macronutrients', 'micronutrients', 'carbohydrates', 'carbs', 'proteins', 'fats',
                   'vitamins', 'minerals', 'antioxidants', 'phytochemicals', 'polyphenols', 'flavonoids',
                   'neuroplasticity', 'neurogenesis', 'neurotransmitters', 'synapses', 'neurons',
                   'cortex', 'amygdala', 'hippocampus', 'prefrontal', 'hypothalamus', 'pituitary',
                   'adrenal', 'thyroid', 'pancreas', 'liver', 'kidneys', 'lungs', 'heart', 'brain',
                   'gut', 'microbiome', 'probiotics', 'prebiotics', 'fiber', 'digestion', 'absorption',
                   'inflammation', 'immune', 'immunity', 'antibodies', 'antigens', 'pathogens',
                   'viruses', 'bacteria', 'fungi', 'parasites', 'vaccines', 'antibiotics', 'antivirals',
                   'antifungals', 'antiparasitics', 'cancer', 'tumors', 'oncogenes', 'carcinogens',
                   'chemotherapy', 'radiation', 'surgery', 'immunotherapy', 'targeted', 'precision',
                   'genetics', 'epigenetics', 'mutations', 'polymorphisms', 'alleles', 'chromosomes',
                   'telomeres', 'telomerase', 'aging', 'longevity', 'healthspan', 'lifespan',
                   'mortality', 'morbidity', 'diseases', 'syndromes', 'disorders', 'conditions',
                   'symptoms', 'signs', 'diagnoses', 'prognoses', 'treatments', 'therapies',
                   'interventions', 'prevention', 'screening', 'monitoring', 'management',
                   'cure', 'remission', 'relapse', 'recovery', 'rehabilitation', 'palliative',
                   'hospice', 'end-of-life', 'death', 'dying', 'grief', 'bereavement', 'mourning',
                   'psychology', 'psychiatry', 'neuroscience', 'biology', 'chemistry', 'physics',
                   'mathematics', 'statistics', 'epidemiology', 'public', 'health', 'medicine',
                   'nursing', 'pharmacy', 'dentistry', 'veterinary', 'agriculture', 'nutrition',
                   'dietetics', 'kinesiology', 'exercise', 'sports', 'fitness', 'wellness',
                   'lifestyle', 'habits', 'behaviors', 'routines', 'practices', 'rituals',
                   'mindfulness', 'meditation', 'yoga', 'tai', 'chi', 'qigong', 'martial', 'arts',
                   'mindset', 'craftsman', 'passion', 'valuable'}
    valid_words.update(w.lower() for w in extra_words)

    with open('book-note-content.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Strip HTML tags
    text = re.sub(r'<[^>]+>', ' ', content)
    
    # Split into words (letters only)
    words = re.findall(r'[A-Za-z]+', text)
    
    suspicious = []
    seen = set()
    for word in words:
        w_lower = word.lower()
        if len(w_lower) > 5 and w_lower not in valid_words and w_lower not in seen:
            seen.add(w_lower)
            suspicious.append(word)
            
    print(f"Found {len(suspicious)} suspicious words.")
    for word in sorted(suspicious)[:100]:
        print(word)

if __name__ == '__main__':
    check_spell()
